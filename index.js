const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ===== Эндпоинт для AI запросов (совместим с OpenAI) =====
app.post('/v1/chat/completions', async (req, res) => {
    try {
        const userMessage = req.body.messages?.[0]?.content || '';

        if (!userMessage) {
            return res.status(400).json({ error: 'Сообщение не найдено' });
        }

        // ===== ПЫТАЕМСЯ ПОЛУЧИТЬ ОТВЕТ ОТ БЕСПЛАТНЫХ ПРОВАЙДЕРОВ =====
        const providers = [
            {
                name: 'Groq',
                url: 'https://api.groq.com/openai/v1/chat/completions',
                key: process.env.GROQ_API_KEY,
                model: 'llama-3.3-70b-versatile'
            },
            {
                name: 'OpenRouter',
                url: 'https://openrouter.ai/api/v1/chat/completions',
                key: process.env.OPENROUTER_API_KEY,
                model: 'meta-llama/llama-3.3-70b-instruct:free'
            }
        ];

        let lastError = null;

        for (const provider of providers) {
            if (!provider.key) continue;

            try {
                const response = await axios.post(
                    provider.url,
                    {
                        model: provider.model,
                        messages: [{ role: 'user', content: userMessage }],
                        max_tokens: 1000
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${provider.key}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 30000
                    }
                );

                const reply = response.data.choices?.[0]?.message?.content;
                if (reply) {
                    console.log(`✅ Ответ от ${provider.name}`);
                    return res.json({
                        choices: [{ message: { content: reply } }]
                    });
                }
            } catch (e) {
                console.log(`❌ ${provider.name} упал: ${e.message}`);
                lastError = e;
            }
        }

        // Если все провайдеры упали
        return res.status(500).json({
            error: 'Все AI провайдеры недоступны',
            details: lastError?.message || 'Неизвестная ошибка'
        });

    } catch (error) {
        console.error('Ошибка шлюза:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ЗДОРОВЬЕ =====
app.get('/health', (req, res) => {
    res.json({ status: 'ok', providers: {
        groq: !!process.env.GROQ_API_KEY,
        openrouter: !!process.env.OPENROUTER_API_KEY
    }});
});

// ===== ЗАПУСК =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ AI Gateway запущен на порту ${PORT}`);
    console.log(`🔗 Эндпоинт: /v1/chat/completions`);
    console.log(`💚 Health: /health`);
});
