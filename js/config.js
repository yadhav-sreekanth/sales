// Supabase client configuration
window.SUPABASE_URL = 'https://edbarzzryvrtycjlxkjb.supabase.co';
window.SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkYmFyenpyeXZydHljamx4a2piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDUyMDcsImV4cCI6MjA5NTM4MTIwN30.1KTdQG9SpMiwEI0hRtuA8SQnjG5iFxu7WxEMHlGTW5E';
window.sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});
window.fmtINR = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
window.fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
