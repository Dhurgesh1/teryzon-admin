import { supabase } from '../assets/js/supabase-auth.js';

const status = document.querySelector('#admin-status');
const setStatus = (message, error = false) => { status.textContent = message; status.className = error ? 'admin-error' : ''; };
const formatDate = (value) => value ? new Intl.DateTimeFormat([], { dateStyle: 'medium' }).format(new Date(value)) : 'No date';
const count = (rows) => rows?.length || 0;

const loadAdmin = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.replace('/login'); return; }
  const { data: profile, error: profileError } = await supabase.from('profiles').select('full_name,email,role').eq('id', user.id).single();
  if (profileError || !profile || !['admin', 'super_admin'].includes(profile.role)) { setStatus('You do not have permission to access the admin console.', true); return; }
  document.querySelector('#admin-name').textContent = profile.full_name || profile.email || 'Admin';
  document.querySelector('#admin-role').textContent = profile.role.replace('_', ' ');

  const [users, tickets, announcements, feedback, userCount, openCount, urgentCount] = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,role,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('support_tickets').select('ticket_number,name,email,category,priority,status,created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('announcements').select('id,title,type,status,created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('feedback').select('id,rating,message,category,created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).not('status', 'in', '(Resolved,Closed)'),
    supabase.from('support_tickets').select('id', { count: 'exact', head: true }).in('priority', ['High', 'Urgent'])
  ]);
  const errors = [users, tickets, announcements, feedback, userCount, openCount, urgentCount].filter((result) => result.error);
  if (errors.length) { setStatus('Some admin data could not be loaded. Check your Supabase policies.', true); return; }

  const userRows = users.data || []; const ticketRows = tickets.data || []; const announcementRows = announcements.data || []; const feedbackRows = feedback.data || [];
  document.querySelector('#metric-users').textContent = userCount.count ?? count(userRows);
  document.querySelector('#metric-open').textContent = openCount.count ?? 0;
  document.querySelector('#metric-urgent').textContent = urgentCount.count ?? 0;
  document.querySelector('#metric-announcements').textContent = announcementRows.filter((item) => item.status === 'Published').length;
  document.querySelector('#ticket-list').innerHTML = ticketRows.length ? ticketRows.map((ticket) => `<tr><td>${ticket.ticket_number}</td><td>${ticket.name}<small>${ticket.email}</small></td><td>${ticket.category}</td><td><span class="admin-status ${ticket.status.toLowerCase().replaceAll(' ', '-')}">${ticket.status}</span></td><td>${formatDate(ticket.created_at)}</td></tr>`).join('') : '<tr><td colspan="5" class="admin-empty">No support tickets yet.</td></tr>';
  document.querySelector('#announcement-list').innerHTML = announcementRows.length ? announcementRows.map((item) => `<tr><td>${item.title}</td><td>${item.type}</td><td><span class="admin-status ${item.status.toLowerCase()}">${item.status}</span></td><td>${formatDate(item.created_at)}</td></tr>`).join('') : '<tr><td colspan="4" class="admin-empty">No announcements yet.</td></tr>';
  document.querySelector('#feedback-list').innerHTML = feedbackRows.length ? feedbackRows.map((item) => `<li><strong>${'★'.repeat(item.rating)}${'☆'.repeat(5 - item.rating)}</strong><span>${item.message}</span><small>${formatDate(item.created_at)}</small></li>`).join('') : '<li class="admin-empty">No feedback received yet.</li>';
  setStatus('Live data connected');
};

document.querySelector('#admin-menu-toggle').addEventListener('click', () => document.querySelector('.admin-nav').classList.toggle('is-open'));
document.querySelector('#admin-signout').addEventListener('click', async () => { await supabase.auth.signOut(); window.location.replace('/login'); });
loadAdmin().catch(() => setStatus('Unable to load the admin console right now.', true));
