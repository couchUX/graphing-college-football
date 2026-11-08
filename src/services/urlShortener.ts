// Simple URL sharing utilities

import { GARBAGE_TIME_PARAM } from '../utils/garbageTime';

export interface ShareUrlParams {
  year: number;
  team: string;
  gameId?: string;
  teamColor?: string;
  opponentColor?: string;
  /** The garbage-time param's value, null at the default (see utils/garbageTime). */
  garbageTime?: string | null;
}

// Create shareable URL with minimal parameters
export const createShareableUrl = (params: ShareUrlParams): string => {
  const urlParams = new URLSearchParams();

  urlParams.set('year', params.year.toString());
  urlParams.set('team', params.team);

  if (params.gameId) {
    urlParams.set('gameId', params.gameId);
  }

  // Add color parameters only if they're not default
  if (params.teamColor && params.teamColor !== 'default') {
    urlParams.set('teamColor', params.teamColor);
  }
  if (params.opponentColor && params.opponentColor !== 'default') {
    urlParams.set('opponentColor', params.opponentColor);
  }
  if (params.garbageTime) {
    urlParams.set(GARBAGE_TIME_PARAM, params.garbageTime);
  }

  return `${window.location.origin}/?${urlParams.toString()}`;
};

// Copy text to clipboard
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
      return true;
    } catch (fallbackErr) {
      console.error('Failed to copy to clipboard:', fallbackErr);
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

