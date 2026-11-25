# Agua y Rosa AI — generación de imágenes

## Qué se añadió
- Interfaz para elegir prenda, ocasión y estilo y generar una imagen de inspiración.
- Función serverless `/api/generate-outfit` para llamar a OpenAI desde el servidor.
- Validación de opciones, límite básico por instancia, control de método HTTP y respuestas de error.
- La clave de OpenAI nunca se envía al navegador ni se guarda en GitHub.

## Despliegue requerido en Vercel
GitHub Pages solo sirve archivos estáticos y no ejecuta la función `api/generate-outfit.js`. Para activar la generación, despliega este repositorio en Vercel:

1. Entra a Vercel e inicia sesión con GitHub.
2. Importa el repositorio `vpaez2111-lgtm/agua-y-rosa`.
3. Usa la configuración por defecto. Vercel detectará la función en `/api`.
4. En el proyecto de Vercel abre **Settings → Environment Variables**.
5. Añade `OPENAI_API_KEY` con una clave API de OpenAI. Selecciona Production (y Preview si vas a probar previews).
6. Guarda y vuelve a desplegar para que la variable esté disponible.
7. Abre el dominio de Vercel y prueba el generador. La ruta `/api/generate-outfit` debe quedar en el mismo dominio de la página.

**Seguridad:** nunca escribas la clave en `index.html`, en un archivo del repositorio ni en el chat. No compartas capturas que muestren la clave. Configura límites de gasto y uso en tu cuenta de OpenAI.

## Modelo y endpoint
Se utiliza la Images API `POST https://api.openai.com/v1/images/generations` con `gpt-image-2.5-flare`, tamaño vertical `1024x1536`, calidad media y formato WebP. La documentación oficial indica que Flare está orientado a generación rápida y de alta calidad. La imagen se devuelve en base64 al navegador para mostrarla y permitir guardarla.

## Limitaciones conocidas
- La imagen es una propuesta visual generada; no garantiza reproducir exactamente cortes, lavados, costuras o detalles de una referencia real del catálogo. Para mayor fidelidad habría que enviar fotografías de producto como imágenes de referencia mediante el flujo de edición.
- La función usa un límite de solicitudes en memoria por instancia serverless. Es una protección básica; para producción con varias instancias debe reemplazarse por rate limiting compartido (por ejemplo, Vercel KV/Redis).
- No hay almacenamiento permanente de imágenes ni historial de clientas.
- El chatbot conversacional existente continúa usando reglas del navegador; esta integración añade generación de imágenes, no un modelo de lenguaje para todas las respuestas.
- Las llamadas generan consumo facturable en la cuenta de OpenAI. La disponibilidad también depende de que la organización tenga habilitado el modelo y la API.

## Prueba rápida
Después de configurar la clave y desplegar en Vercel:
1. Selecciona una prenda, ocasión y estilo.
2. Pulsa **Generar imagen con IA**.
3. Comprueba que aparece una imagen y que el botón **Guardar imagen** funciona.
4. Envía una solicitud sin configurar la clave en un entorno de prueba: debe aparecer un mensaje de configuración y nunca exponerse la clave.
