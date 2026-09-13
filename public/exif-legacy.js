// Fallback metadata reader for older Lightroom/Canon JPEG exports.
window.readLegacyExif = async function(file){
  try{
    const text = await file.slice(0, 4 * 1024 * 1024).text();
    const get = name => {
      const keys = [name + '="', name + "='"];
      for (const key of keys) {
        const at = text.indexOf(key);
        if (at >= 0) {
          const quote = key.slice(-1);
          const start = at + key.length;
          const end = text.indexOf(quote, start);
          if (end > start) return text.slice(start, end);
        }
      }
      return '';
    };
    const number = value => {
      if (!value) return 0;
      const parts = String(value).trim().split('/').map(Number);
      return parts.length === 2 && parts[1] ? parts[0] / parts[1] : Number(parts[0]) || 0;
    };
    const focal = number(get('exif:FocalLength') || get('FocalLength'));
    const aperture = number(get('exif:FNumber') || get('FNumber'));
    const exposure = number(get('exif:ExposureTime') || get('ExposureTime'));
    return {
      focal_length: focal > 0 ? `${Math.round(focal * 10) / 10} mm` : '',
      aperture: aperture > 0 ? `f/${Math.round(aperture * 10) / 10}` : '',
      shutter_speed: exposure > 0 ? (exposure < 1 ? `1/${Math.round(1 / exposure)}` : `${Math.round(exposure * 100) / 100}s`) : ''
    };
  } catch (_) {
    return {};
  }
};