export default function handler(request, response) {
  response.status(200).json({
    status: 'unavailable',
    missing: true,
    message: 'No validated regional terrain and hazard grid is bundled with this public demo. The map and science layers remain available.'
  });
}
