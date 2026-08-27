/**
 * Smoke de rasterizado para la imagen de produccion.
 *
 * Alpine no trae fuentes de sistema, asi que las graficas dependen de los TTF
 * que la imagen copia en packages/backend/assets/fonts y de que la ruta relativa
 * desde dist/ siga cuadrando. Si eso se rompe, resvg no falla: devuelve un PNG
 * perfectamente valido con el texto invisible. El healthcheck responde 200, el
 * deploy sale verde y el fallo se ve a la manana siguiente en Discord.
 *
 * Por eso la comprobacion no es "sale un PNG", es "el texto deja tinta":
 * se rasteriza el mismo SVG con y sin el texto acentuado y los dos PNG tienen
 * que salir distintos. Sin fuentes cargadas salen identicos byte a byte.
 *
 * Se ejecuta DENTRO de la imagen ya construida (ver scripts/smoke-charts-fonts.sh),
 * usando el servicio compilado en dist para pasar por la misma resolucion de
 * rutas que en produccion.
 */
const DIST_SERVICE =
  '/app/packages/backend/dist/infrastructure/charts/svg-to-png.service.js';

const WIDTH = 780;
const TEXT = 'Sesión nº 89 · ñÁÉÍÓÚ · 1:23.456';

const svg = (withText) => `
<svg xmlns="http://www.w3.org/2000/svg" width="390" height="60" viewBox="0 0 390 60">
  <rect width="390" height="60" fill="#111111"/>
  ${withText ? `<text x="12" y="38" font-family="Inter" font-size="20" fill="#EAE2D6">${TEXT}</text>` : ''}
</svg>`;

const fail = (message) => {
  console.error(`smoke-charts-fonts: ${message}`);
  process.exit(1);
};

const isPng = (buffer) =>
  buffer.length > 8 &&
  buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );

let SvgToPngService;
try {
  ({ SvgToPngService } = require(DIST_SERVICE));
} catch (error) {
  fail(`no se puede cargar ${DIST_SERVICE}: ${error.message}`);
}

const service = new SvgToPngService();

let withText;
let withoutText;
try {
  withText = service.toPng(svg(true), WIDTH);
  withoutText = service.toPng(svg(false), WIDTH);
} catch (error) {
  fail(`resvg ha fallado al rasterizar: ${error.message}`);
}

if (!isPng(withText)) {
  fail('la salida no es un PNG valido');
}

if (withText.equals(withoutText)) {
  fail(
    'el texto no ha dejado tinta: las fuentes de assets/fonts no se estan cargando ' +
      '(revisa el COPY de assets en el Dockerfile y la ruta FONTS_DIR de svg-to-png.service)',
  );
}

console.log(
  `smoke-charts-fonts: OK · texto rasterizado en ${withText.length} bytes ` +
    `(control sin texto: ${withoutText.length} bytes)`,
);
