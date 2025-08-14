// API Configuration
export const API_BASE_URL = 'https://api.collegefootballdata.com';

// Get API key from environment variables
const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_CFB_API_KEY;
  
  // Debug logging for Vercel
  console.log('Environment check:', {
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    envVarName: 'VITE_CFB_API_KEY',
    allEnvVars: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')),
    firstChars: apiKey?.substring(0, 10) || 'undefined',
    lastChars: apiKey?.substring(apiKey.length - 10) || 'undefined'
  });
  
  if (!apiKey) {
    throw new Error(
      'Missing API key. Please set VITE_CFB_API_KEY in your .env file. ' +
      'Get your API key from: https://api.collegefootballdata.com/'
    );
  }
  
  // Clean the API key - remove any potential whitespace/newlines
  return apiKey.trim();
};

// Shared headers for all API requests
export const getApiHeaders = () => {
  const apiKey = getApiKey();
  console.log('Creating headers with API key (first 10 chars):', apiKey.substring(0, 10));
  
  // College Football Data API uses Authorization header with Bearer token
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  
  console.log('Final Authorization header (first 20 chars):', headers.Authorization.substring(0, 20) + '...');
  
  return headers;
};

// Export API key getter for backward compatibility
export const getApiToken = getApiKey;