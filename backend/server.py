# backend/server.py
# ----------------------------------------------------------------
# Este backend ha sido ELIMINADO. La aplicación usa arquitectura
# serverless: el frontend Angular se conecta directamente a Supabase.
# Este archivo es un placeholder mínimo para que supervisord no
# genere crash-restart loops (el conf de supervisor es readonly).
# ----------------------------------------------------------------
async def app(scope, receive, send):
    """Minimal ASGI placeholder — no external dependencies needed."""
    if scope['type'] == 'lifespan':
        while True:
            msg = await receive()
            if msg['type'] == 'lifespan.startup':
                print("GymFichaje: backend disabled (serverless via Supabase)")
                await send({'type': 'lifespan.startup.complete'})
            elif msg['type'] == 'lifespan.shutdown':
                await send({'type': 'lifespan.shutdown.complete'})
                return
    elif scope['type'] == 'http':
        await send({
            'type': 'http.response.start',
            'status': 200,
            'headers': [(b'content-type', b'text/plain; charset=utf-8')]
        })
        await send({
            'type': 'http.response.body',
            'body': b'Backend disabled. GymFichaje is serverless via Supabase.'
        })
