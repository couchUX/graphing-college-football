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
    allEnvVars: Object.keys(import.meta.env).filter(key => key.startsWith('VITE_'))
  });
  
  if (!apiKey) {
    throw new Error(
      'Missing API key. Please set VITE_CFB_API_KEY in your .env file. ' +
      'Get your API key from: https://api.collegefootballdata.com/'
    );
  }
  
  return apiKey;
};

// Shared headers for all API requests
export const getApiHeaders = () => ({
  'Authorization': `Bearer ${getApiKey()}`,
  'Content-Type': 'application/json',
});

// Export API key getter for backward compatibility
export const getApiToken = getApiKey;