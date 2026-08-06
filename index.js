const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ===== КОНФИГУРАЦИЯ ПРОВАЙДЕРОВ =====
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
    },
    {
        name: 'NVIDIA NIM',
        url: 'https://integrate.api.nvidia.com/v1/chat/completions',
        key: process.env.NVIDIA_API_KEY,
        model: 'meta/llama-3.3-70b-instruct'
    },
    {
        name: 'Cerebras',
        url: 'https://api.cerebras.ai/v1/chat/completions',
        key: process.env.CEREBRAS_API_KEY,
        model: 'llama-3.3-70b'
    },
    {
        name: 'Together AI',
        url: 'https://api.together.xyz/v1/chat/completions',
        key: process.env.TOGETHER_API_KEY,
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
    }
];

// ===== ФИЛЬТРУЕМ ТОЛЬКО ТЕХ, У КОГО ЕСТЬ КЛЮЧ =====
const activeProviders = providers.filter(p => p.key);

console.log(`🔌 Загружено ${activeProviders.length} активных провайдеров:`);
activeProviders.forEach(p => console.log(`   ✅ ${p.name}`));

// ===== ЭНДПОИНТ ДЛЯ AI ЗАПРОСОВ =====
app.post('/v1/chat/completions', async (req, res) => {
    const startTime = Date.now();
    const userMessage = req.body.messages?.[0]?.content || '';

    if (!userMessage) {
        return res.status(400).json({ error: 'Сообщение не найдено' });
    }

    console.log(`📨 Новый запрос: "${userMessage.slice(0, 50)}..."`);

    // Перебираем провайдеров пока не получим ответ
    for (let i = 0; i < activeProviders.length; i++) {
        const provider = activeProviders[i];

        try {
            console.log(`🔄 Попытка ${i + 1}/${activeProviders.length}: ${provider.name}`);

            const response = await axios.post(
                provider.url,
                {
                    model: provider.model,
                    messages: [{ role: 'user', content: userMessage }],
                    max_tokens: 1000,
                    temperature: 0.7
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
                const duration = Date.now() - startTime;
                console.log(`✅ Ответ от ${provider.name} (${duration}ms)`);
                return res.json({
                    choices: [{ message: { content: reply } }]
                });
            }
        } catch (e) {
            console.log(`❌ ${provider.name} упал: ${e.message}`);
            continue; // Переходим к следующему провайдеру
        }
    }

    // Если все провайдеры упали
    console.error('❌ Все провайдеры недоступны!');
    return res.status(503).json({
        error: 'Все AI провайдеры недоступны',
        providers: activeProviders.map(p => p.name)
    });
});

// ===== ЭНДПОИНТ ДЛЯ ПРОВЕРКИ СТАТУСА =====
app.get('/health', (req, res) => {
    const status = {};
    activeProviders.forEach(p => {
        status[p.name.toLowerCase().replace(/\s/g, '_')] = true;
    });
    res.json({
        status: 'ok',
        providers: status,
        uptime: process.uptime()
    });
});

// ===== ЭНДПОИНТ ДЛЯ КОРНЯ =====
app.get('/', (req, res) => {
    res.json({
        name: 'AI Gateway',
        version: '2.0.0',
        providers: activeProviders.map(p => p.name),
        endpoints: {
            chat: '/v1/chat/completions',
            health: '/health'
        }
    });
});

// ===== ЗАПУСК =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 AI Gateway запущен на порту ${PORT}`);
    console.log(`📊 Активных провайдеров: ${activeProviders.length}`);
    console.log(`🔗 Эндпоинт: /v1/chat/completions`);
    console.log(`💚 Health: /health`);
});
