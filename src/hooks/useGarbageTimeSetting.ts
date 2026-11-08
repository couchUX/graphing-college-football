import { useCallback, useState } from 'react';
import { readParams, writeParams } from '../utils/urlState';
import { GARBAGE_TIME_PARAM, garbageTimeParamValue, readExcludeGarbageTime } from '../utils/garbageTime';

/**
 * The page's garbage-time setting, kept in the query string like every other
 * view setting so a copied link (and a card's share link) reopens the numbers
 * the way they were shown. It applies the moment it changes — every play is
 * already tagged — so nothing is refetched and nothing needs pinning.
 */
export const useGarbageTimeSetting = (): [boolean, (exclude: boolean) => void] => {
  const [exclude, setExclude] = useState(() => readExcludeGarbageTime(readParams()));

  const update = useCallback((next: boolean) => {
    setExclude(next);
    writeParams({ [GARBAGE_TIME_PARAM]: garbageTimeParamValue(next) });
  }, []);

  return [exclude, update];
};
