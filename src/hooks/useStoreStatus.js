import { useMemo, useCallback } from "react";

/**
 * useStoreStatus — determines if the store is open/closed based on server time and store_hours.
 * Also provides available hours for scheduling.
 * @param {Object} sett - store settings (must include store_hours)
 * @param {Date|null} serverNow - server timestamp to avoid client clock manipulation
 */
export default function useStoreStatus(sett, serverNow) {
  // Is the store open right now?
  const storeStatus = useMemo(() => {
    const hrs = sett?.store_hours;
    if (!hrs) return { open: true, msg: "" };
    const now = serverNow || new Date();
    const dayIdx = (now.getDay() + 6) % 7; // JS: 0=Dom → 0=Lun
    const today = hrs[dayIdx];
    if (!today || today.closed) return { open: false, msg: "Hoy no abrimos" };
    if (!today.open || !today.close) return { open: true, msg: "" };
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = today.open.split(":").map(Number);
    const [ch, cm] = today.close.split(":").map(Number);
    const openMins = oh * 60 + om;
    const closeMins = ch * 60 + cm;
    if (nowMins < openMins) return { open: false, msg: `Abrimos a las ${today.open}` };
    if (nowMins >= closeMins) return { open: false, msg: `Cerramos a las ${today.close}. Podés programar tu pedido.` };
    return { open: true, msg: `Abierto hasta las ${today.close}` };
  }, [sett, serverNow]);

  // Minimum scheduling date
  const minDate = useMemo(() => {
    const now = serverNow || new Date();
    return now.toISOString().split("T")[0];
  }, [serverNow]);

  // Available hours for a specific date
  const getAvailableHours = useCallback((dateStr) => {
    if (!dateStr || !sett?.store_hours) return [];
    const [y, m, d] = dateStr.split("-").map(Number);
    const selectedDate = new Date(y, m - 1, d);
    const jsDow = selectedDate.getDay();
    const dayIdx = (jsDow + 6) % 7;
    const dayHrs = sett.store_hours[dayIdx];
    if (!dayHrs || dayHrs.closed || !dayHrs.open || !dayHrs.close) return [];

    const [oh] = dayHrs.open.split(":").map(Number);
    const [ch] = dayHrs.close.split(":").map(Number);
    const firstHour = oh + 1;
    const lastHour = ch - 1;
    if (firstHour > lastHour) return [];

    const now = serverNow || new Date();
    const isToday = dateStr === now.toISOString().split("T")[0];
    const currentHour = now.getHours();

    const hours = [];
    for (let h = firstHour; h <= lastHour; h++) {
      if (isToday && h <= currentHour + 1) continue;
      hours.push(h);
    }
    return hours;
  }, [sett, serverNow]);

  // Day info for a selected date
  const getDayInfo = useCallback((dateStr) => {
    if (!dateStr || !sett?.store_hours) return null;
    const [y, m, d] = dateStr.split("-").map(Number);
    const selectedDate = new Date(y, m - 1, d);
    const jsDow = selectedDate.getDay();
    const dayIdx = (jsDow + 6) % 7;
    const dayHrs = sett.store_hours[dayIdx];
    const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    if (!dayHrs || dayHrs.closed) return { closed: true, dayName: dayNames[dayIdx] };
    return { closed: false, dayName: dayNames[dayIdx], open: dayHrs.open, close: dayHrs.close };
  }, [sett]);

  return { storeStatus, minDate, getAvailableHours, getDayInfo };
}
