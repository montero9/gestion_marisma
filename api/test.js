export default async function handler(req, res) {
  try {
    const mod = await import('./index.js');
    res.status(200).json({
      success: true,
      hasDefault: Boolean(mod.default),
      defaultType: typeof mod.default,
      appKeys: Object.keys(mod.default || {}),
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack,
    });
  }
}
