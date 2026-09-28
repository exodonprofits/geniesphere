/**
 * GenieSphere browser-safe configuration.
 * In production, inject these values during deployment or generate this file
 * from environment variables. Never place secret/service-role keys here.
 */
window.GenieSphereConfig = window.GenieSphereConfig || {
  supabaseUrl: window.GS_SUPABASE_URL || '',
  supabaseAnonKey: window.GS_SUPABASE_ANON_KEY || '',
  appName: 'GenieSphere',
  environment: 'development'
};
