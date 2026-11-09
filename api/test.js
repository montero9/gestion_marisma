import handler from './index.js';

export default async function testHandler(req, res) {
  try {
    return handler(req, res);
  } catch (err) {
    res.status(500).json({
      error: err.message,
      stack: err.stack,
    });
  }
}
