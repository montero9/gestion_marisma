export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    url: req.url,
    method: req.method,
    has_supabase_url: Boolean(process.env.SUPABASE_URL),
    has_supabase_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    has_jwt_secret: Boolean(process.env.JWT_SECRET),
    env_node_version: process.version,
  });
}
