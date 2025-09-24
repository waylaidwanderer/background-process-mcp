import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, measureElement, useStdout } from 'ink';
import stringWidth from 'string-width';
import { ProcessInfo } from '../../types/index.js';

interface ProcessOutputProps {
  process: ProcessInfo | undefined;
}

export const ProcessOutput: React.FC<ProcessOutputProps> = ({ process }) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);
  const { stdout } = useStdout();

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        const { width, height } = measureElement(containerRef.current);
        setDimensions({ width, height });
      }
    };

    // A short timeout helps ensure the layout has settled before measuring.
    const timeoutId = setTimeout(measure, 50);
    stdout.on('resize', measure);

    return () => {
      clearTimeout(timeoutId);
      stdout.off('resize', measure);
    };
  }, [stdout, process?.output]); // Re-measure when output changes to catch layout shifts

  const renderContent = () => {
    if (!process) {
      return <Text color="gray">No process selected.</Text>;
    }
    if (process.output === undefined) {
      return <Text color="gray">Loading history...</Text>;
    }
    if (process.output) {
      const { width, height } = dimensions;
      if (width <= 0 || height <= 0) return null;

      const allLines = process.output.split('\n');
      const visibleLines: string[] = [];
      let currentHeight = 0;

      // Fill the container from the bottom up with the most recent lines.
      for (let i = allLines.length - 1; i >= 0; i--) {
        const line = allLines[i];
        const visualHeight = line.length === 0 ? 1 : Math.ceil(stringWidth(line) / width);

        if (currentHeight + visualHeight <= height) {
          visibleLines.unshift(line);
          currentHeight += visualHeight;
        } else {
          break;
        }
      }

      // If truncation is needed, make space for the truncation message.
      const truncatedCount = allLines.length - visibleLines.length;
      if (truncatedCount > 0) {
        const truncationMessage = `... (truncated ${truncatedCount} lines) ...`;
        const messageHeight = Math.ceil(stringWidth(truncationMessage) / width);
        
        // Remove lines from the top until the message fits.
        while (currentHeight + messageHeight > height && visibleLines.length > 0) {
          const removedLine = visibleLines.shift()!;
          const removedHeight = removedLine.length === 0 ? 1 : Math.ceil(stringWidth(removedLine) / width);
          currentHeight -= removedHeight;
        }

        // Only add the message if there's enough space.
        if (currentHeight + messageHeight <= height) {
          visibleLines.unshift(truncationMessage);
        }
      }
      
      return <Text>{visibleLines.join('\n')}</Text>;
    }
    return <Text color="gray">No output for this process.</Text>;
  };

  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column" flexGrow={1}>
      <Text color="cyan">Output</Text>
      <Box ref={containerRef} marginTop={1} flexGrow={1} overflow="hidden" minHeight={0}>
        {dimensions.height > 0 && renderContent()}
      </Box>
    </Box>
  );
};