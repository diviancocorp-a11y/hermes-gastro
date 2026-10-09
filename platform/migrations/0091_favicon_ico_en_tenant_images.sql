-- 0091 — El bucket tenant-images acepta .ico (favicon).
--
-- Personalizacion pide un favicon y el formato natural es .ico, pero el bucket
-- solo dejaba jpeg/png/webp/gif: la subida se rechazaba. Chrome/Windows
-- reporta el .ico como image/x-icon o image/vnd.microsoft.icon segun el
-- sistema, asi que van los dos. El cliente (platformStorage.js) lo permite
-- solo para el prefijo 'favicon'.

update storage.buckets
   set allowed_mime_types = array[
     'image/jpeg', 'image/png', 'image/webp', 'image/gif',
     'image/x-icon', 'image/vnd.microsoft.icon'
   ]
 where id = 'tenant-images';
