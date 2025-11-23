import config from '../config.js';

export function addLoginRoute(router: any) {
  /**
   * API: Admin Login
   */
  router.post('/api/auth/login', (req: any, res: any) => {
    try {
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ success: false, error: 'Password is required' });
      }

      if (password === config.ADMIN_PASSWORD) {
        return res.json({ success: true, message: 'Login successful' });
      } else {
        return res.status(401).json({ success: false, error: 'Invalid password' });
      }
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Login failed' });
    }
  });
}
