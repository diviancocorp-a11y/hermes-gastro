// src/services/reviews.js
// CRUD operations for customer reviews.
import { supabase } from '../lib/supabase';

export async function submitReview({ orderId, customerName, customerPhone, rating, comment }) {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      order_id: orderId,
      customer_name: customerName,
      customer_phone: customerPhone,
      rating,
      comment: comment || '',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPublicReviews({ limit = 20 } = {}) {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, customer_name, rating, comment, created_at')
    .eq('visible', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getAdminReviews({ limit = 100 } = {}) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function toggleReviewVisibility(id, visible) {
  const { error } = await supabase
    .from('reviews')
    .update({ visible })
    .eq('id', id);

  if (error) throw error;
}

export async function getReviewStats() {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('visible', true);

  if (error) throw error;
  const reviews = data || [];
  const total = reviews.length;
  const avg = total ? reviews.reduce((s, r) => s + r.rating, 0) / total : 0;
  const distribution = [0, 0, 0, 0, 0]; // index 0 = 1 star, etc.
  reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) distribution[r.rating - 1]++; });

  return { total, average: Math.round(avg * 10) / 10, distribution };
}

export async function hasReviewedOrder(orderId) {
  const { data } = await supabase
    .from('reviews')
    .select('id')
    .eq('order_id', orderId)
    .limit(1);

  return (data?.length || 0) > 0;
}
