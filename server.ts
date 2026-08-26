import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { isGeminiConfigured } from './server/gemini/client';
import { processSystemInputWithGemini } from './server/gemini/systemProcessor';
import { testGeminiHealth, listAvailableGeminiModels, categorizeGeminiError } from './server/gemini/contextSummarizer';
import { GEMINI_MODEL_NAME } from './server/gemini/prompts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middlewares
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'SYSTEM CORE ENGINE',
      timestamp: new Date().toISOString(),
      geminiConfigured: isGeminiConfigured(),
      model: GEMINI_MODEL_NAME,
    });
  });

  // Check Gemini Status
  app.get('/api/gemini/status', (req, res) => {
    const customKey = (req.headers['x-gemini-api-key'] as string) || undefined;
    const configured = isGeminiConfigured(customKey);
    res.json({
      configured,
      status: configured ? 'CONFIGURED' : 'NOT CONFIGURED',
      model: GEMINI_MODEL_NAME,
      hasServerEnvKey: isGeminiConfigured(),
      message: configured
        ? 'Gemini API key active.'
        : 'No Gemini API key detected.',
    });
  });

  // Discover & List Compatible Gemini Models
  app.post('/api/gemini/models', async (req, res) => {
    const customKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey || undefined;
    try {
      const models = await listAvailableGeminiModels(customKey);
      res.json({
        success: true,
        models,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to list Gemini models',
      });
    }
  });

  // Also support GET for quick model lookup
  app.get('/api/gemini/models', async (req, res) => {
    const customKey = (req.headers['x-gemini-api-key'] as string) || undefined;
    try {
      const models = await listAvailableGeminiModels(customKey);
      res.json({
        success: true,
        models,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to list Gemini models',
      });
    }
  });

  // Test Gemini Connection
  app.post('/api/gemini/test-connection', async (req, res) => {
    const customKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey || undefined;
    const selectedModel = req.body?.model || undefined;

    if (!isGeminiConfigured(customKey)) {
      return res.status(400).json({
        connected: false,
        model: selectedModel || GEMINI_MODEL_NAME,
        category: 'Invalid API key',
        error: 'No Gemini API key provided or found in environment.',
      });
    }

    try {
      const health = await testGeminiHealth({
        customApiKey: customKey,
        selectedModel,
      });

      if (health.ok) {
        res.json({
          connected: true,
          model: health.model,
          latencyMs: health.latencyMs,
          message: 'Gemini Connection ✓',
        });
      } else {
        res.status(200).json({
          connected: false,
          model: health.model,
          latencyMs: health.latencyMs,
          category: health.category || 'Request rejected',
          error: health.message || 'Connection test failed',
        });
      }
    } catch (err: any) {
      const category = categorizeGeminiError(err);
      res.status(200).json({
        connected: false,
        model: selectedModel || GEMINI_MODEL_NAME,
        category,
        error: err.message || 'Failed to communicate with Gemini API',
      });
    }
  });

  // Process System Input with Gemini Pipeline
  app.post('/api/gemini/process-system-input', async (req, res) => {
    const customKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey || undefined;
    const {
      rawMessage,
      playerState,
      recentMemories,
      importantMemories,
      stateVersion,
      systemVersion,
      model,
    } = req.body;

    if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
      return res.status(400).json({
        success: false,
        error: 'rawMessage string is required in request body.',
      });
    }

    if (!isGeminiConfigured(customKey)) {
      return res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured.',
        notConfigured: true,
      });
    }

    try {
      const { result, usedModel } = await processSystemInputWithGemini({
        rawMessage,
        playerState,
        recentMemories,
        importantMemories,
        stateVersion,
        systemVersion,
        model,
        customApiKey: customKey,
      });

      res.json({
        success: true,
        data: result,
        model: usedModel,
        processedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Gemini System Processing error:', err?.message);
      const category = categorizeGeminiError(err);
      const isQuota = category === 'Quota exceeded';

      res.status(isQuota ? 429 : 500).json({
        success: false,
        category,
        isQuotaExceeded: isQuota,
        error: err.message || 'Gemini processing failed',
        model: model || GEMINI_MODEL_NAME,
      });
    }
  });

  // Vite middleware in dev / Static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SYSTEM CORE] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
