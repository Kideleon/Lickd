-- End-to-end database tests: RLS, privacy, blocking, messaging, groups, dating, moderation.
\set ON_ERROR_STOP on
create schema t;
create table t.results (ok boolean, msg text);
create function t.id(n text) returns uuid language sql immutable as $$ select md5('lickd-' || n)::uuid $$;
create function t.ok(cond boolean, msg text) returns void language plpgsql security definer as $$
begin insert into t.results values (coalesce(cond, false), msg); end $$;
create function t.as(n text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', t.id(n)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function t.sys() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', true); perform set_config('request.jwt.claim.sub', '', true); end $$;
create function t.fails(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return true; end $$;
create function t.n(q text) returns bigint language plpgsql as $$
declare r bigint; begin execute q into r; return r; end $$;
grant usage on schema t to authenticated;
grant execute on all functions in schema t to authenticated;

-- ═════════ setup: users ═════════
do $$
declare n text;
begin
  foreach n in array array['alice','bea','cara','dee','mod','admin','minor','nobday'] loop
    insert into auth.users (id, email, raw_user_meta_data) values (t.id(n), n || '@x.test',
      case n when 'minor' then '{"birthdate":"2015-05-05","accepted_terms":"true"}'::jsonb
             when 'nobday' then '{"accepted_terms":"true"}'::jsonb
             else '{"birthdate":"1995-01-01","accepted_terms":"true"}'::jsonb end);
  end loop;
  insert into auth.users (id, email, raw_user_meta_data) values (t.id('noterms'), 'noterms@x.test', '{"birthdate":"1995-01-01"}');

  -- age / terms / username gates
  perform t.as('minor');   perform t.ok(t.fails($q$select register_profile('minor1','Minor')$q$), 'under-18 cannot register');
  perform t.as('nobday');  perform t.ok(t.fails($q$select register_profile('nobday1','NoBday')$q$), 'missing birthdate cannot register');
  perform t.as('noterms'); perform t.ok(t.fails($q$select register_profile('noterms1','NT')$q$), 'unaccepted terms cannot register');
  perform t.as('alice');   perform t.ok(t.fails($q$select register_profile('AB','Short')$q$), 'bad username rejected');
  foreach n in array array['alice','bea','cara','dee','mod','admin'] loop
    perform t.as(n);
    perform register_profile(n, initcap(n));
    update profiles set onboarded = true, city = 'Atlanta', interests = array['music','art'] where id = t.id(n);
  end loop;
  perform t.as('bea');
  perform t.ok(t.fails($q$select register_profile('alice','Dupe')$q$), 'dup profile/username rejected');
  perform t.ok((select username_available('ALICE')) = false, 'username availability is case-insensitive');
  perform t.ok((select username_available('fresh_name')), 'fresh username available');
  perform t.sys();
  update profiles set role = 'moderator' where id = t.id('mod');
  update profiles set role = 'admin' where id = t.id('admin');
  perform t.ok(t.n('select count(*) from profiles') = 6, 'six profiles created');
  perform t.ok(t.n('select count(*) from profile_private') = 6, 'private rows created');
end $$;

-- ═════════ profile privacy & column security ═════════
do $$ begin
  perform t.as('alice');
  perform t.ok(t.fails($q$update profiles set role = 'admin' where id = t.id('alice')$q$), 'cannot self-promote to admin');
  perform t.ok(t.fails($q$update profiles set status = 'active', suspended_until = null where id = t.id('alice')$q$), 'cannot edit status column');
  perform t.ok(t.fails($q$insert into profiles (id, username, display_name) values (gen_random_uuid(), 'sneaky', 'S')$q$), 'cannot insert profile directly');
  perform t.ok(t.fails($q$select birthdate from profile_private where user_id = t.id('bea')$q$) or
               t.n($q$select count(*) from profile_private where user_id = t.id('bea')$q$) = 0, 'cannot read others'' birthdate');
  perform t.ok(t.n($q$select count(*) from profile_private where user_id = t.id('alice')$q$) = 1, 'can read own private row');
  perform t.ok(t.fails($q$update profiles set avatar_path = 'someoneelse/x.jpg' where id = t.id('alice')$q$), 'cannot point avatar at another user''s file');
  update profiles set avatar_path = t.id('alice')::text || '/a.jpg', bio = 'hi' where id = t.id('alice');
  perform t.ok(true, 'can edit own profile');
  perform t.ok(t.fails($q$update profiles set bio = 'hacked' where id = t.id('bea')$q$) or t.n($q$select count(*) from profiles where bio='hacked'$q$) = 0, 'cannot edit others'' profile');

  -- friends-only discoverability
  perform t.as('bea'); update profiles set discoverability = 'friends' where id = t.id('bea');
  perform t.as('alice');
  perform t.ok(t.n($q$select count(*) from profiles where id = t.id('bea')$q$) = 0, 'friends-only profile hidden from strangers');
  perform t.ok(t.n($q$select count(*) from discover_people()$q$) = 4, 'discover_people hides friends-only profile and self');
  perform t.as('bea'); update profiles set discoverability = 'unlisted' where id = t.id('bea');
  perform t.as('alice');
  perform t.ok(t.n($q$select count(*) from profiles where id = t.id('bea')$q$) = 1, 'unlisted profile viewable by link');
  perform t.ok(t.n($q$select count(*) from discover_people() where id = t.id('bea')$q$) = 0, 'unlisted profile not in discover');
  perform t.as('bea'); update profiles set discoverability = 'everyone' where id = t.id('bea');
end $$;

-- ═════════ friend requests ═════════
do $$ declare fid uuid; r text; begin
  perform t.as('alice');
  r := send_friend_request(t.id('bea'));
  perform t.ok(r = 'request_sent', 'friend request sent');
  perform t.ok(send_friend_request(t.id('bea')) = 'request_sent', 'duplicate request is idempotent');
  perform t.ok(t.n($q$select count(*) from notifications$q$) = 0, 'sender has no notification');
  perform t.as('bea');
  perform t.ok(t.n($q$select count(*) from notifications where type='friend_request'$q$) = 1, 'recipient notified of request');
  perform t.ok(t.n($q$select count(*) from get_friend_requests()$q$) = 1, 'request listed');
  perform t.ok(t.fails($q$update friendships set status='accepted'$q$), 'cannot accept via direct update');
  select id into fid from friendships limit 1;
  perform respond_friend_request(fid, true);
  perform t.ok(are_friends(t.id('alice'), t.id('bea')), 'friends after accept');
  perform t.as('alice');
  perform t.ok(t.n($q$select count(*) from notifications where type='friend_accept'$q$) = 1, 'requester notified of accept');

  -- reverse pending auto-accepts
  perform t.as('cara'); perform send_friend_request(t.id('dee'));
  perform t.as('dee');  r := send_friend_request(t.id('cara'));
  perform t.ok(r = 'friends', 'mutual request auto-accepts');

  -- decline
  perform t.as('mod'); perform send_friend_request(t.id('alice'));
  perform t.as('alice'); select id into fid from friendships where requester_id = t.id('mod');
  perform respond_friend_request(fid, false);
  perform t.ok(t.n($q$select count(*) from friendships where requester_id = t.id('mod')$q$) = 0, 'declined request removed');

  -- who_can_friend = nobody
  perform t.as('cara'); update profiles set who_can_friend = 'nobody' where id = t.id('cara');
  perform t.as('alice');
  perform t.ok(t.fails($q$select send_friend_request(t.id('cara'))$q$), 'cannot friend someone who disabled requests');
  perform t.ok(t.fails($q$insert into follows (follower_id, following_id) values (t.id('alice'), t.id('cara'))$q$), 'cannot follow someone who disabled requests');
  perform t.as('cara'); update profiles set who_can_friend = 'everyone' where id = t.id('cara');

  -- top 8 only friends
  perform t.as('alice');
  insert into top8 values (t.id('alice'), 1, t.id('bea'));
  perform t.ok(t.fails($q$insert into top8 values (t.id('alice'), 2, t.id('cara'))$q$), 'top8 rejects non-friends');
  perform t.ok(jsonb_array_length(get_profile_summary(t.id('alice'))->'top8') = 1, 'top8 returned in summary');
  perform t.ok(get_profile_summary(t.id('bea'))->>'relationship' = 'friends', 'relationship = friends');
  perform t.ok(get_profile_summary(t.id('cara'))->>'relationship' = 'none', 'relationship = none');
end $$;

-- ═════════ posts, feed, reactions, comments, privacy ═════════
do $$ declare pub uuid; fr uuid; own text := t.id('alice')::text; begin
  perform t.as('alice');
  insert into posts (author_id, body, audience) values (t.id('alice'), 'public hello #lickd #vibes', 'public') returning id into pub;
  insert into posts (author_id, body, audience, location) values (t.id('alice'), 'friends only', 'friends', 'The Eagle') returning id into fr;
  perform t.ok(t.fails($q$insert into posts (author_id, body) values (t.id('bea'), 'spoof')$q$), 'cannot post as someone else');
  perform t.ok(t.fails($q$insert into posts (author_id, body, media_paths, media_types) values (t.id('alice'), 'x', array['bea/secret.jpg'], array['image'])$q$), 'cannot attach another user''s media');
  perform t.ok(t.fails($q$insert into posts (author_id, body) values (t.id('alice'), '')$q$), 'empty post rejected');
  perform t.ok(t.fails($q$insert into posts (author_id, body, like_count) values (t.id('alice'), 'x', 999)$q$), 'cannot set counters');

  perform t.as('bea');  -- friend
  perform t.ok(t.n($q$select count(*) from get_feed('for_you')$q$) = 2, 'friend sees public + friends post');
  perform t.as('cara'); -- stranger
  perform t.ok(t.n($q$select count(*) from get_feed('for_you')$q$) = 1, 'stranger sees only public post');
  perform t.ok(t.n($q$select count(*) from posts where audience='friends'$q$) = 0, 'friends post invisible to stranger');
  perform t.ok(t.n($q$select count(*) from get_feed('following')$q$) = 0, 'following feed empty before follow');
  perform t.ok(t.n($q$select count(*) from get_feed('trending')$q$) = 1, 'trending shows public post');

  -- like + comment + notification
  insert into reactions (user_id, target_type, target_id) values (t.id('cara'), 'post', pub);
  perform t.ok(t.fails(format($q$insert into reactions (user_id, target_type, target_id) values (t.id('cara'), 'post', %L)$q$, fr)), 'cannot react to invisible post');
  insert into comments (post_id, author_id, body) values (pub, t.id('cara'), 'love this');
  perform t.ok(t.fails(format($q$insert into comments (post_id, author_id, body) values (%L, t.id('cara'), 'sneaky')$q$, fr)), 'cannot comment on invisible post');
  perform t.sys();
  perform t.ok((select like_count from posts where id = pub) = 1, 'like_count incremented');
  perform t.ok((select comment_count from posts where id = pub) = 1, 'comment_count incremented');
  perform t.as('alice');
  perform t.ok(t.n($q$select count(*) from notifications where type='like'$q$) = 1, 'author notified of like');
  perform t.ok(t.n($q$select count(*) from notifications where type='comment'$q$) = 1, 'author notified of comment');
  insert into reactions (user_id, target_type, target_id) values (t.id('alice'), 'post', pub);
  perform t.ok(t.n($q$select count(*) from notifications where type='like'$q$) = 1, 'no self-like notification');
  delete from reactions where user_id = t.id('alice') and target_id = pub;
  perform t.sys();
  perform t.ok((select like_count from posts where id = pub) = 1, 'unlike decrements');

  -- follow → following feed
  perform t.as('cara'); insert into follows values (t.id('cara'), t.id('alice'));
  perform t.ok(t.n($q$select count(*) from get_feed('following')$q$) = 1, 'following feed shows followed user''s visible post');
  perform t.as('alice');
  perform t.ok(t.n($q$select count(*) from notifications where type='follow'$q$) = 1, 'followed user notified');

  -- edit / delete own, not others'
  perform t.as('cara');
  perform t.ok(t.n(format($q$with u as (update posts set body='pwned' where id=%L returning 1) select count(*) from u$q$, pub)) = 0, 'cannot edit others'' posts');
  perform t.ok(t.n(format($q$with d as (delete from posts where id=%L returning 1) select count(*) from d$q$, pub)) = 0, 'cannot delete others'' posts');

  -- tags/places
  perform t.ok(t.n($q$select count(*) from trending_tags()$q$) = 2, 'trending tags extracted');
  perform t.ok(t.n($q$select count(*) from discover_places() $q$) = 0, 'friends-only location not exposed in places');

  -- mute hides from feed
  insert into mutes values (t.id('cara'), t.id('alice'));
  perform t.ok(t.n($q$select count(*) from get_feed('for_you')$q$) = 0, 'muted user hidden from feed');
  delete from mutes where muter_id = t.id('cara');
end $$;

-- ═════════ blocking ═════════
do $$ declare pid uuid; begin
  perform t.as('dee'); insert into posts (author_id, body) values (t.id('dee'), 'dee public') returning id into pid;
  perform t.as('cara'); perform t.ok(t.n($q$select count(*) from posts where author_id = t.id('dee')$q$) = 1, 'sees dee before block');
  insert into blocks values (t.id('cara'), t.id('dee'));
  perform t.ok(t.n($q$select count(*) from posts where author_id = t.id('dee')$q$) = 0, 'blocker no longer sees blocked user''s posts');
  perform t.ok(t.n($q$select count(*) from profiles where id = t.id('dee')$q$) = 0, 'blocker no longer sees blocked profile');
  perform t.ok(not are_friends(t.id('cara'), t.id('dee')), 'block removes friendship');
  perform t.as('dee');
  perform t.ok(t.n($q$select count(*) from profiles where id = t.id('cara')$q$) = 0, 'blocked user cannot see blocker profile');
  perform t.ok(t.n($q$select count(*) from posts where author_id = t.id('cara')$q$) = 0, 'blocked user cannot see blocker posts');
  perform t.ok(t.fails($q$select open_conversation(t.id('cara'))$q$), 'blocked user cannot start conversation');
  perform t.ok(t.fails($q$select send_friend_request(t.id('cara'))$q$), 'blocked user cannot friend');
  perform t.ok(t.fails($q$insert into follows values (t.id('dee'), t.id('cara'))$q$), 'blocked user cannot follow');
  perform t.ok(t.n($q$select count(*) from discover_people() where id = t.id('cara')$q$) = 0, 'blocked user absent from discover');
  perform t.ok(t.n($q$select count(*) from blocks$q$) = 0, 'blocked user cannot see block list');
  perform t.as('cara');
  perform t.ok(t.n($q$select count(*) from get_blocked_users()$q$) = 1, 'blocked list readable via RPC');
  delete from blocks where blocker_id = t.id('cara');
  perform t.ok(t.n($q$select count(*) from profiles where id = t.id('dee')$q$) = 1, 'unblock restores visibility');
end $$;

-- ═════════ messaging ═════════
do $$ declare c uuid; c2 uuid; i int; mid uuid; begin
  perform t.as('cara'); update profiles set who_can_message = 'nobody' where id = t.id('cara');
  perform t.as('alice'); perform t.ok(t.fails($q$select open_conversation(t.id('cara'))$q$), 'who_can_message=nobody blocks DMs');
  perform t.as('cara'); update profiles set who_can_message = 'friends' where id = t.id('cara');
  perform t.as('alice'); perform t.ok(t.fails($q$select open_conversation(t.id('cara'))$q$), 'friends-only DMs reject strangers');
  perform t.as('cara'); update profiles set who_can_message = 'everyone' where id = t.id('cara');

  -- friends: active; strangers: request
  perform t.as('alice'); c := open_conversation(t.id('bea'));
  perform t.ok((select status from conversations where id = c) = 'active', 'friend conversation is active');
  c2 := open_conversation(t.id('cara'));
  perform t.ok((select status from conversations where id = c2) = 'request', 'stranger conversation is a request');
  perform t.ok(open_conversation(t.id('cara')) = c2, 'conversation reused');

  insert into messages (conversation_id, sender_id, body) values (c2, t.id('alice'), 'hey 1');
  insert into messages (conversation_id, sender_id, body) values (c2, t.id('alice'), 'hey 2');
  insert into messages (conversation_id, sender_id, body) values (c2, t.id('alice'), 'hey 3');
  perform t.ok(t.fails(format($q$insert into messages (conversation_id, sender_id, body) values (%L, t.id('alice'), 'hey 4')$q$, c2)), 'request senders capped at 3 messages');

  perform t.sys(); update conversation_participants set last_read_at = now() - interval '1 hour' where conversation_id = c2;
  perform t.as('cara');
  perform t.ok(t.n($q$select count(*) from get_conversations(true)$q$) = 1, 'request shows in recipient requests');
  perform t.ok(t.n($q$select count(*) from get_conversations(false)$q$) = 0, 'request not in main inbox');
  perform t.ok((select unread_count from get_conversations(true) limit 1) = 3, 'unread count = 3');
  perform t.ok(t.fails(format($q$insert into messages (conversation_id, sender_id, body) values (%L, t.id('cara'), 'reply early')$q$, c2)), 'recipient cannot reply before accepting');
  perform t.ok(t.n($q$select count(*) from notifications where type='message'$q$) = 3, 'message notifications created');
  update conversation_participants set last_read_at = now() + interval '1 second' where conversation_id = c2 and user_id = t.id('cara');
  perform t.ok((select unread_count from get_conversations(true) limit 1) = 0, 'mark read clears unread');
  perform respond_message_request(c2, true);
  insert into messages (conversation_id, sender_id, body) values (c2, t.id('cara'), 'hi back');
  perform t.ok(t.n($q$select count(*) from get_conversations(false)$q$) = 1, 'accepted conversation in main inbox');

  -- privacy: outsiders can't read
  perform t.as('dee');
  perform t.ok(t.n('select count(*) from messages') = 0, 'outsider sees no messages');
  perform t.ok(t.n('select count(*) from conversations') = 0, 'outsider sees no conversations');
  perform t.ok(t.fails(format($q$insert into messages (conversation_id, sender_id, body) values (%L, t.id('dee'), 'intrude')$q$, c2)), 'outsider cannot post into conversation');
  perform t.ok(t.fails(format($q$insert into messages (conversation_id, sender_id, body) values (%L, t.id('alice'), 'forged')$q$, c2)), 'cannot forge sender');

  -- decline
  perform t.as('dee'); c := open_conversation(t.id('alice'));
  insert into messages (conversation_id, sender_id, body) values (c, t.id('dee'), 'yo');
  perform t.as('alice'); perform respond_message_request(c, false);
  perform t.as('dee');
  perform t.ok(t.fails(format($q$insert into messages (conversation_id, sender_id, body) values (%L, t.id('dee'), 'again')$q$, c)), 'declined requester cannot keep messaging');

  -- blocking kills an active conversation
  perform t.as('cara'); insert into blocks values (t.id('cara'), t.id('alice'));
  perform t.ok(t.n('select count(*) from messages') = 0, 'blocker sees no messages from blocked user');
  perform t.ok(t.fails(format($q$insert into messages (conversation_id, sender_id, body) values (%L, t.id('cara'), 'x')$q$, c2)), 'blocker cannot send');
  perform t.as('alice');
  perform t.ok(t.n(format($q$select count(*) from messages where conversation_id=%L$q$, c2)) = 0, 'blocked user loses access to history');
  perform t.ok(t.fails(format($q$insert into messages (conversation_id, sender_id, body) values (%L, t.id('alice'), 'x')$q$, c2)), 'blocked user cannot send');
  perform t.ok(t.n($q$select count(*) from get_conversations(false) where other_id = t.id('cara')$q$) = 0, 'blocked conversation hidden from list');
  perform t.as('cara'); delete from blocks where blocker_id = t.id('cara');

  -- rate limit
  perform t.as('alice'); c := open_conversation(t.id('bea'));
  declare hit boolean := false; k int := 0; begin
    for i in 1..60 loop k := i;
      begin insert into messages (conversation_id, sender_id, body) values (c, t.id('alice'), 'spam ' || i);
      exception when sqlstate 'P0429' then hit := true; exit; end;
    end loop;
    perform t.ok(hit and k <= 41, 'message rate limit enforced (stopped at ' || k || ')');
  end;
end $$;

-- ═════════ groups ═════════
do $$ declare gpub uuid; gpriv uuid; pp uuid; begin
  perform t.as('alice');
  insert into groups (owner_id, name, privacy) values (t.id('alice'), 'Atlanta Femmes', 'public') returning id into gpub;
  insert into groups (owner_id, name, privacy) values (t.id('alice'), 'Secret Circle', 'private') returning id into gpriv;
  perform t.ok(is_group_mod(gpub), 'creator is group owner/mod');
  perform t.ok(t.fails($q$insert into group_members (group_id, user_id, role) select id, t.id('alice'), 'owner' from groups limit 1$q$), 'duplicate/owner insert rejected');

  perform t.as('bea');
  insert into group_members (group_id, user_id) values (gpub, t.id('bea'));
  perform t.ok((select status from group_members where group_id = gpub and user_id = t.id('bea')) = 'active', 'public group join is immediate');
  insert into group_members (group_id, user_id) values (gpriv, t.id('bea'));
  perform t.ok((select status from group_members where group_id = gpriv and user_id = t.id('bea')) = 'pending', 'private group join is pending');
  perform t.ok(t.fails(format($q$update group_members set status='active' where group_id=%L and user_id=t.id('bea')$q$, gpriv)) or
               (select status from group_members where group_id = gpriv and user_id = t.id('bea')) = 'pending', 'cannot self-approve');
  perform t.ok(t.fails(format($q$insert into group_members (group_id, user_id, status, role) values (%L, t.id('cara'), 'active', 'owner')$q$, gpub)), 'cannot add others/escalate');
  perform t.ok(t.fails(format($q$insert into posts (author_id, body, audience, group_id) values (t.id('bea'), 'x', 'group', %L)$q$, gpriv)), 'pending member cannot post');

  perform t.as('alice');
  perform t.ok(t.n(format($q$select count(*) from group_members where group_id=%L and status='pending'$q$, gpriv)) = 1, 'owner sees pending request');
  update group_members set status = 'active' where group_id = gpriv and user_id = t.id('bea');
  perform t.ok((select member_count from groups where id = gpriv) = 2, 'member_count updated');
  insert into posts (author_id, body, audience, group_id) values (t.id('alice'), 'secret post', 'group', gpriv) returning id into pp;

  perform t.as('cara');
  perform t.ok(t.n(format($q$select count(*) from posts where id=%L$q$, pp)) = 0, 'non-member cannot read private group post');
  perform t.ok(t.n(format($q$select count(*) from group_members where group_id=%L$q$, gpriv)) = 0, 'non-member cannot see private member list');
  perform t.ok(t.n(format($q$select count(*) from groups where id=%L$q$, gpriv)) = 1, 'private group is discoverable by name');
  perform t.ok(t.n($q$select count(*) from get_feed('for_you') where group_id is not null$q$) = 0, 'group posts excluded from non-member feed');
  perform t.as('bea');
  perform t.ok(t.n(format($q$select count(*) from posts where id=%L$q$, pp)) = 1, 'member reads private group post');
  perform t.ok(t.n($q$select count(*) from get_feed('for_you') where group_id is not null$q$) = 1, 'group posts in member feed');

  -- moderation within group: ban + post removal
  perform t.as('alice');
  perform t.ok(t.n(format($q$with d as (delete from posts where id=%L returning 1) select count(*) from d$q$, pp)) = 1, 'owner can delete group post');
  update group_members set status = 'banned' where group_id = gpub and user_id = t.id('bea');
  perform t.as('bea');
  perform t.ok(t.fails(format($q$delete from group_members where group_id=%L and user_id=t.id('bea')$q$, gpub)) or
               (select status from group_members where group_id = gpub and user_id = t.id('bea')) = 'banned', 'banned member stays banned');
  perform t.ok(t.fails(format($q$insert into posts (author_id, body, audience, group_id) values (t.id('bea'), 'x', 'group', %L)$q$, gpub)), 'banned member cannot post');
  perform t.ok(t.n(format($q$with d as (delete from group_members where group_id=%L and user_id=t.id('alice') returning 1) select count(*) from d$q$, gpub)) = 0, 'owner cannot be removed');

  -- group events
  perform t.as('alice');
  insert into events (creator_id, group_id, title, starts_at, privacy) values (t.id('alice'), gpriv, 'Members night', now() + interval '2 hours', 'private');
  perform t.as('cara');
  perform t.ok(t.n($q$select count(*) from events where title='Members night'$q$) = 0, 'private group event hidden from non-members');
end $$;

-- ═════════ events ═════════
do $$ declare e uuid; begin
  perform t.as('alice');
  insert into events (creator_id, title, starts_at, location, city, privacy) values (t.id('alice'), 'Pride Brunch', now() + interval '3 days', 'Midtown', 'Atlanta', 'public') returning id into e;
  perform t.ok((select going_count from events where id = e) = 1, 'creator auto-going');
  perform t.ok(t.fails($q$insert into events (creator_id, title, starts_at, ends_at) values (t.id('alice'), 'Bad', now(), now() - interval '1 day')$q$), 'event end before start rejected');
  perform t.as('cara');
  insert into event_attendees values (e, t.id('cara'), 'interested');
  update event_attendees set status = 'going' where event_id = e and user_id = t.id('cara');
  perform t.ok((select going_count from events where id = e) = 2 and (select interested_count from events where id = e) = 0, 'attendance counters track status changes');
  perform t.ok(t.n($q$select count(*) from discover_events() $q$) >= 1, 'event discoverable');
  perform t.ok((select my_status from discover_events() where id = e) = 'going', 'my_status reported');
  perform t.as('alice');
  perform t.ok(t.n($q$select count(*) from notifications where type='event_activity'$q$) = 1, 'creator notified someone is going');
  -- reminders
  perform t.sys(); update events set starts_at = now() + interval '5 hours' where id = e;
  perform t.ok(send_event_reminders() = 3, 'reminders sent to all attendees');
  perform t.ok(send_event_reminders() = 0, 'reminders not duplicated');
  perform t.as('cara');
  perform t.ok(t.n($q$select count(*) from notifications where type='event_reminder'$q$) = 1, 'attendee has reminder');
  perform t.ok(t.fails($q$select send_event_reminders()$q$), 'clients cannot trigger reminders');
  perform t.ok(t.fails($q$select notify(t.id('cara'), t.id('alice'), 'like', null, null)$q$), 'clients cannot forge notifications');
  -- private event
  perform t.as('alice');
  insert into events (creator_id, title, starts_at, privacy) values (t.id('alice'), 'House party', now() + interval '1 day', 'private');
  perform t.as('bea'); perform t.ok(t.n($q$select count(*) from events where title='House party'$q$) = 1, 'friend sees private event');
  perform t.as('cara'); perform t.ok(t.n($q$select count(*) from events where title='House party'$q$) = 0, 'stranger cannot see private event');
end $$;

-- ═════════ stories ═════════
do $$ declare s_all uuid; s_fr uuid; s_cf uuid; ap text := t.id('alice')::text; begin
  perform t.as('cara'); insert into follows values (t.id('cara'), t.id('alice'));
  perform t.as('alice');
  insert into stories (author_id, media_path, media_type, audience) values (t.id('alice'), ap || '/s1.jpg', 'image', 'everyone') returning id into s_all;
  insert into stories (author_id, media_path, media_type, audience) values (t.id('alice'), ap || '/s2.jpg', 'image', 'friends') returning id into s_fr;
  insert into stories (author_id, media_path, media_type, audience) values (t.id('alice'), ap || '/s3.jpg', 'image', 'close_friends') returning id into s_cf;
  insert into close_friends values (t.id('alice'), t.id('bea'));
  perform t.ok(t.fails($q$insert into close_friends values (t.id('alice'), t.id('cara'))$q$), 'close friends must be friends');
  perform t.ok((select expires_at from stories where id = s_all) > now() + interval '23 hours', 'story expires in 24h');

  perform t.as('cara');
  perform t.ok(t.n($q$select count(*) from stories$q$) = 1, 'stranger sees only everyone-story');
  perform t.ok(t.n($q$select count(*) from get_story_tray()$q$) = 1, 'story tray follows followed user (cara follows alice)');
  perform t.as('bea');
  perform t.ok(t.n($q$select count(*) from stories$q$) = 3, 'close friend sees all three');
  insert into story_views (story_id, viewer_id) values (s_fr, t.id('bea'));
  perform t.ok(t.fails(format($q$insert into story_views (story_id, viewer_id) values (%L, t.id('dee'))$q$, s_cf)), 'cannot view story you can''t access');
  perform t.ok((select has_unseen from get_story_tray() where author_id = t.id('alice')) , 'tray reports unseen stories');
  perform t.ok(reply_to_story(s_fr, 'love it 😍') is not null, 'story reply creates DM');
  perform t.ok(t.n($q$select count(*) from messages where story_id is not null$q$) = 1, 'reply stored with story reference');
  perform t.as('alice');
  perform t.ok(t.n(format($q$select count(*) from story_views where story_id=%L$q$, s_fr)) = 1, 'author sees viewer list');
  perform t.as('cara');
  perform t.ok(t.n($q$select count(*) from story_views$q$) = 0, 'others cannot see viewer list');
  -- expiry
  perform t.sys(); update stories set expires_at = now() - interval '1 minute' where id = s_all;
  perform t.as('cara'); perform t.ok(t.n($q$select count(*) from stories$q$) = 0, 'expired story invisible');
  perform t.as('alice'); perform t.ok(t.n($q$select count(*) from stories where id = $q$ || quote_literal(s_all)) = 1, 'author still sees own expired story row until purge');
  perform t.sys(); update stories set expires_at = now() - interval '3 days' where id = s_all;
  perform t.ok((select count(*) from purge_expired_stories()) = 1, 'purge removes expired stories');
end $$;

-- ═════════ albums & media access ═════════
do $$ declare al uuid; ap text := t.id('alice')::text; begin
  perform t.as('alice');
  insert into albums (owner_id, title, privacy) values (t.id('alice'), 'Private', 'private') returning id into al;
  insert into album_media (album_id, path) values (al, ap || '/p1.jpg');
  perform t.ok(t.fails(format($q$insert into album_media (album_id, path) values (%L, 'bea/stolen.jpg')$q$, al)), 'cannot add other user''s file to album');
  perform t.ok(can_read_media(ap || '/p1.jpg'), 'owner reads own media');
  perform t.as('bea');
  perform t.ok(t.n($q$select count(*) from albums where title='Private'$q$) = 0, 'private album hidden from friend');
  perform t.ok(not can_read_media(ap || '/p1.jpg'), 'private album photo unreadable by friend');
  perform t.ok(t.n($q$select count(*) from album_media$q$) = 0, 'private album media rows hidden');
  perform t.as('alice'); update albums set privacy = 'friends' where id = al;
  perform t.as('bea');   perform t.ok(can_read_media(ap || '/p1.jpg'), 'friends album readable by friend');
  perform t.as('cara');  perform t.ok(not can_read_media(ap || '/p1.jpg'), 'friends album unreadable by stranger');
  perform t.as('alice'); update albums set privacy = 'public' where id = al;
  perform t.as('cara');  perform t.ok(can_read_media(ap || '/p1.jpg'), 'public album readable');
  perform t.ok(t.n($q$select count(*) from album_media$q$) = 1, 'public album media listed');
  perform t.ok(t.fails($q$delete from albums where title = 'Private'$q$) or t.n($q$select count(*) from albums$q$) = 1, 'cannot delete others'' albums');

  -- post & message media
  perform t.as('alice');
  insert into posts (author_id, body, audience, media_paths, media_types) values (t.id('alice'), 'pic', 'friends', array[ap || '/post.jpg'], array['image']);
  perform t.as('bea');   perform t.ok(can_read_media(ap || '/post.jpg'), 'friend can read friends-post media');
  perform t.as('cara');  perform t.ok(not can_read_media(ap || '/post.jpg'), 'stranger cannot read friends-post media');
  perform t.as('bea');
  insert into messages (conversation_id, sender_id, media_path, media_type)
    select id, t.id('bea'), t.id('bea')::text || '/dm.jpg', 'image' from conversations c
     where exists (select 1 from conversation_participants p where p.conversation_id = c.id and p.user_id = t.id('alice'))
       and exists (select 1 from conversation_participants p where p.conversation_id = c.id and p.user_id = t.id('bea')) limit 1;
  perform t.as('alice'); perform t.ok(can_read_media(t.id('bea')::text || '/dm.jpg'), 'DM participant reads DM media');
  perform t.as('cara');  perform t.ok(not can_read_media(t.id('bea')::text || '/dm.jpg'), 'outsider cannot read DM media');
end $$;

-- ═════════ dating ═════════
do $$ declare r jsonb; conv uuid; begin
  perform t.as('alice'); perform t.ok(t.fails($q$select * from dating_candidates()$q$), 'dating requires opting in');
  update profiles set dating_enabled = true, dating_headline = 'hi' where id = t.id('alice');
  perform t.as('bea');  update profiles set dating_enabled = true where id = t.id('bea');
  perform t.as('cara'); update profiles set dating_enabled = true where id = t.id('cara');
  perform t.as('dee');  update profiles set dating_enabled = false where id = t.id('dee');
  perform t.as('alice');
  perform t.ok(t.n($q$select count(*) from dating_candidates()$q$) = 2, 'candidates: only dating-enabled, unblocked (bea; cara blocked? ) ' || t.n($q$select count(*) from dating_candidates()$q$));
  perform t.ok(t.n($q$select count(*) from dating_candidates() where id = t.id('dee')$q$) = 0, 'dating-off users hidden');
  perform t.ok(t.fails($q$select dating_swipe(t.id('dee'), 'like')$q$), 'cannot swipe ineligible profile');
  perform t.ok(t.fails($q$select * from dating_likes$q$), 'clients cannot read dating_likes');
  r := dating_swipe(t.id('bea'), 'like');
  perform t.ok((r->>'matched')::boolean = false, 'one-sided like is not a match');
  perform t.ok(t.n($q$select count(*) from dating_candidates() where id = t.id('bea')$q$) = 0, 'swiped profile not shown again');
  perform t.as('bea');
  perform t.ok(t.n($q$select count(*) from dating_candidates('likes')$q$) = 1, 'likes view shows who liked me');
  r := dating_swipe(t.id('alice'), 'like');
  perform t.ok((r->>'matched')::boolean, 'mutual like creates match');
  perform t.ok(t.n($q$select count(*) from get_matches()$q$) = 1, 'match listed');
  perform t.ok(t.n($q$select count(*) from notifications where type='match'$q$) = 1, 'match notification');
  perform t.as('cara');
  perform t.ok(t.n($q$select count(*) from matches$q$) = 0, 'others cannot see match');
  -- pass is not a like
  r := dating_swipe(t.id('alice'), 'pass');
  perform t.as('alice');
  perform t.ok(t.n($q$select count(*) from dating_candidates('likes')$q$) = 0, 'pass is not surfaced as a like');
  -- minors never eligible
  perform t.sys();
  update profile_private set birthdate = '2015-01-01' where user_id = t.id('cara');
  perform t.ok(not dating_eligible(t.id('cara')), 'under-18 profile ineligible for dating');
  update profile_private set birthdate = '1995-01-01' where user_id = t.id('cara');
end $$;

-- ═════════ reports, moderation, suspension, appeals ═════════
do $$ declare pid uuid; rid uuid; rid2 uuid; mid uuid; c uuid; begin
  perform t.as('alice');
  insert into posts (author_id, body) values (t.id('alice'), 'offensive thing') returning id into pid;
  perform t.as('cara');
  insert into reports (target_type, target_id, reason, details) values ('post', pid, 'harassment', 'rude') returning id into rid;
  perform t.ok((select target_user_id from reports where id = rid) = t.id('alice'), 'report resolves offender');
  perform t.ok((select snapshot->>'body' from reports where id = rid) = 'offensive thing', 'report snapshots content');
  perform t.ok(t.fails(format($q$insert into reports (target_type, target_id, reason) values ('post', %L, 'spam')$q$, pid)), 'duplicate open report rejected');
  perform t.ok(t.fails($q$insert into reports (target_type, target_id, reason) values ('user', t.id('cara'), 'spam')$q$), 'cannot report yourself');
  perform t.ok(t.fails(format($q$insert into reports (target_type, target_id, reason, status) values ('post', %L, 'spam', 'resolved')$q$, pid)), 'cannot set report status');
  perform t.ok(t.fails($q$insert into reports (target_type, target_id, reason) values ('post', gen_random_uuid(), 'spam')$q$), 'report on missing content rejected');
  perform t.ok(t.n('select count(*) from reports') = 1, 'reporter sees own report');
  perform t.as('dee'); perform t.ok(t.n('select count(*) from reports') = 0, 'other users cannot see reports');
  perform t.ok(t.fails($q$select admin_metrics()$q$), 'non-staff cannot read metrics');
  perform t.ok(t.fails($q$select mod_remove_content('post', gen_random_uuid(), 'x')$q$), 'non-staff cannot moderate');
  perform t.ok(t.fails($q$select * from mod_actions$q$) or t.n('select count(*) from mod_actions') = 0, 'non-staff cannot read audit log');

  -- DM report gives staff context without general DM access
  perform t.as('cara');
  select m.id, m.conversation_id into mid, c from messages m where m.sender_id = t.id('alice') limit 1;
  insert into reports (target_type, target_id, reason) values ('message', mid, 'harassment') returning id into rid2;
  perform t.as('mod');
  perform t.ok(t.n('select count(*) from reports') = 2, 'moderator sees reports queue');
  perform t.ok((select jsonb_array_length(snapshot->'context') from reports where id = rid2) >= 1, 'message report carries conversation context');
  perform t.ok(t.n('select count(*) from messages') = 0, 'moderator has no general DM access');
  perform t.ok(admin_metrics()->>'reports_open' = '2', 'metrics reflect open reports');
  perform mod_mark_reviewing(rid);
  perform t.ok((select status from reports where id = rid) = 'reviewing', 'mark reviewing');

  -- remove content
  perform mod_resolve_report(rid, 'resolved', 'remove_content', 'harassment confirmed');
  perform t.as('bea'); perform t.ok(t.n(format($q$select count(*) from posts where id=%L$q$, pid)) = 0, 'removed post invisible to users');
  perform t.as('mod'); perform t.ok(t.n(format($q$select count(*) from posts where id=%L$q$, pid)) = 1, 'removed post still visible to staff');
  perform t.as('alice'); perform t.ok(t.n($q$select count(*) from notifications where type='moderation'$q$) = 1, 'author notified of removal');
  perform t.as('cara'); perform t.ok(t.n($q$select count(*) from notifications where type='report_update'$q$) = 1, 'reporter notified of outcome');
  perform t.ok(t.fails(format($q$select mod_resolve_report(%L,'resolved','warn','x')$q$, rid)), 'closed report cannot be resolved again');

  -- suspension: read-only account, can appeal
  perform t.as('mod');
  perform mod_set_user_status(t.id('alice'), 'suspended', 3, 'repeat harassment');
  perform t.as('alice');
  perform t.ok(t.fails($q$insert into posts (author_id, body) values (t.id('alice'), 'still posting')$q$), 'suspended user cannot post');
  perform t.ok(t.n($q$with u as (update profiles set bio = 'x' where id = t.id('alice') returning 1) select count(*) from u$q$) = 0, 'suspended user cannot edit profile');
  perform t.ok(t.fails($q$select send_friend_request(t.id('dee'))$q$), 'suspended user cannot friend');
  perform t.ok(t.n($q$select count(*) from profiles where id = t.id('alice')$q$) = 1, 'suspended user can read own profile (to show suspension screen)');
  perform t.as('bea'); perform t.ok(t.n($q$select count(*) from profiles where id = t.id('alice')$q$) = 0, 'suspended user hidden from others');
  perform t.ok(t.n($q$select count(*) from posts where author_id = t.id('alice')$q$) = 0, 'suspended user''s posts hidden');
  perform t.as('alice');
  insert into appeals (user_id, message) values (t.id('alice'), 'I was joking, please reinstate me.');
  perform t.ok(t.fails($q$insert into appeals (user_id, message) values (t.id('alice'), 'second appeal while one pending')$q$), 'one pending appeal at a time');
  perform t.ok(t.n($q$select count(*) from appeals$q$) = 1, 'user sees own appeal');

  -- role limits
  perform t.as('mod');
  perform t.ok(t.fails($q$select mod_set_user_status(t.id('bea'), 'banned', null, 'x')$q$), 'moderators cannot ban');
  perform t.ok(t.fails($q$select mod_set_user_status(t.id('admin'), 'suspended', 1, 'x')$q$), 'moderators cannot action admins');
  perform t.ok(t.fails($q$select mod_set_user_status(t.id('mod'), 'suspended', 1, 'x')$q$), 'cannot moderate self');
  perform t.ok(t.fails($q$select admin_set_role(t.id('bea'), 'admin')$q$), 'moderators cannot grant roles');
  perform t.ok(t.fails($q$update profiles set role='admin' where id = t.id('mod')$q$), 'staff cannot self-promote');
  perform t.ok(t.fails($q$update mod_actions set reason = 'edited'$q$), 'moderators cannot edit audit log');

  -- admin: appeal upheld reinstates
  perform t.as('admin');
  perform t.ok(t.n('select count(*) from appeals where status = ''pending''') = 1, 'admin sees pending appeal');
  perform mod_resolve_appeal((select id from appeals limit 1), 'upheld', 'ok, reinstated');
  perform t.as('alice');
  insert into posts (author_id, body) values (t.id('alice'), 'back again');
  perform t.ok(true, 'appeal upheld reinstates account');
  perform t.as('admin');
  perform mod_set_user_status(t.id('dee'), 'banned', null, 'abuse');
  perform admin_set_role(t.id('bea'), 'moderator');
  perform t.ok((select role from profiles where id = t.id('bea')) = 'moderator', 'admin grants roles');
  perform admin_set_role(t.id('bea'), 'user');
  perform t.sys();
  perform t.ok(t.fails($q$delete from mod_actions$q$), 'audit log is append-only even for owner');
  perform t.ok((select count(*) from mod_actions) >= 6, 'actions audited: ' || (select count(*) from mod_actions));
  perform t.ok((select count(*) from mod_actions where moderator_id is not null) = (select count(*) from mod_actions), 'every action records its moderator');
  update profiles set status = 'active' where id = t.id('dee');
end $$;

-- ═════════ account lifecycle ═════════
do $$ begin
  perform t.as('dee');
  perform deactivate_my_account();
  perform t.as('bea'); perform t.ok(t.n($q$select count(*) from profiles where id = t.id('dee')$q$) = 0, 'deactivated profile hidden');
  perform t.as('dee'); perform reactivate_my_account();
  perform t.as('bea'); perform t.ok(t.n($q$select count(*) from profiles where id = t.id('dee')$q$) = 1, 'reactivation restores profile');
  perform t.as('alice'); perform t.ok(t.fails($q$select reactivate_my_account()$q$) = false and (select status from profiles where id = t.id('alice')) = 'active', 'reactivate is a no-op for active users');

  -- suspended users cannot self-reactivate
  perform t.sys(); update profiles set status = 'suspended', suspended_until = now() + interval '1 day' where id = t.id('dee');
  perform t.as('dee'); perform reactivate_my_account();
  perform t.ok((select status from profiles where id = t.id('dee')) = 'suspended', 'suspended user cannot self-reactivate');
  perform t.sys(); update profiles set suspended_until = now() - interval '1 minute' where id = t.id('dee');
  perform t.as('dee'); perform t.ok(touch_active() = 'active', 'expired suspension lifts on next launch');

  -- deletion cascades
  perform t.as('dee'); insert into posts (author_id, body) values (t.id('dee'), 'bye');
  perform delete_my_account();
  perform t.sys();
  perform t.ok(t.n($q$select count(*) from auth.users where id = t.id('dee')$q$) = 0, 'auth user deleted');
  perform t.ok(t.n($q$select count(*) from profiles where id = t.id('dee')$q$) = 0, 'profile deleted');
  perform t.ok(t.n($q$select count(*) from posts where author_id = t.id('dee')$q$) = 0, 'posts deleted');
  perform t.ok(t.n($q$select count(*) from mod_actions where target_user_id is null$q$) >= 1, 'audit rows survive with user link cleared');
end $$;

-- ═════════ rate limits ═════════
do $$ declare i int; begin
  perform t.as('cara');
  for i in 1..30 loop insert into posts (author_id, body) values (t.id('cara'), 'p' || i); end loop;
  perform t.ok(t.fails($q$insert into posts (author_id, body) values (t.id('cara'), 'one too many')$q$), 'post rate limit enforced (30/hour)');
  perform t.as('alice'); insert into posts (author_id, body) values (t.id('alice'), 'other users unaffected');
end $$;

-- ═════════ report ═════════
\echo
select case when ok then 'PASS' else 'FAIL' end as r, msg from t.results where not ok order by 1;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
