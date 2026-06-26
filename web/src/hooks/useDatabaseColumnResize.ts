import { useCallback, useEffect, useState } from 'react';
import {
  defaultWidthForProperty,
  loadColumnWidths,
  MIN_COLUMN_WIDTH,
  saveColumnWidths,
} from '../lib/databaseColumnWidths';

export function useDatabaseColumnResize(
  pageId: string,
  properties: Array<{ id: string; name: string }>,
) {
  const [widths, setWidths] = useState<Record<string, number>>(() => loadColumnWidths(pageId));

  useEffect(() => {
    setWidths(loadColumnWidths(pageId));
  }, [pageId]);

  const getWidth = useCallback(
    (propertyId: string, propertyName: string) =>
      widths[propertyId] ?? defaultWidthForProperty(propertyName),
    [widths],
  );

  const setWidth = useCallback(
    (propertyId: string, width: number) => {
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(width));
      setWidths((prev) => {
        const next = { ...prev, [propertyId]: nextWidth };
        saveColumnWidths(pageId, next);
        return next;
      });
    },
    [pageId],
  );

  const startResize = useCallback(
    (propertyId: string, propertyName: string, clientX: number) => {
      const startWidth = getWidth(propertyId, propertyName);
      const startX = clientX;

      const onMove = (event: MouseEvent) => {
        setWidth(propertyId, startWidth + (event.clientX - startX));
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [getWidth, setWidth],
  );

  const tableWidth = properties.reduce(
    (sum, prop) => sum + getWidth(prop.id, prop.name),
    80, // add-column + delete-row columns
  );

  return { getWidth, startResize, tableWidth };
}
