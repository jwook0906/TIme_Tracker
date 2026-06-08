# 랭킹 시스템 (게스트 로그인) 설정 가이드

랭킹 기능은 **Supabase**(관리형 백엔드 서비스)를 사용합니다. 익명(게스트) 인증, 데이터베이스, REST API가 모두 포함되어 있고 무료 티어만으로 충분히 운영할 수 있습니다. 아래는 **최초 1회** 해야 하는 설정입니다.

## 1. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 에 가입하고 **New project**를 생성합니다 (무료 플랜으로 충분).
2. 프로젝트 생성이 끝나면 대시보드 좌측 **Project Settings → API**로 이동해 아래 두 값을 확보합니다.
   - **Project URL** (예: `https://xxxxxxxx.supabase.co`)
   - **anon public** key (긴 문자열 — 클라이언트 앱에 그대로 포함되는 공개 키이며, 노출되어도 안전하도록 아래 RLS 정책이 보호합니다)

## 2. 데이터베이스 스키마 적용

대시보드 좌측 **SQL Editor**를 열고, 아래 SQL 전체를 붙여넣은 뒤 **Run**으로 한 번에 실행합니다.

```sql
-- ============================================================
-- 작업시간 측정기 — 랭킹 시스템 스키마 + 권한 설정
-- ============================================================

-- 1) profiles: 닉네임 등 공개 프로필 (이메일은 저장하지 않음 — 게스트 익명 계정이라 auth.users에도 이메일이 없음)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text unique not null,
  current_streak integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "프로필은 누구나 조회 가능" on public.profiles
  for select using (true);
create policy "본인 프로필만 생성 가능" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "본인 프로필만 수정 가능" on public.profiles
  for update using (auth.uid() = user_id);

-- 2) daily_totals: 날짜별 누적 작업시간 (앱이 주기적으로 upsert)
create table if not exists public.daily_totals (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  total_seconds integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.daily_totals enable row level security;

create policy "기록은 누구나 조회 가능 (랭킹 집계용)" on public.daily_totals
  for select using (true);
create policy "본인 기록만 추가 가능" on public.daily_totals
  for insert with check (auth.uid() = user_id);
create policy "본인 기록만 수정 가능" on public.daily_totals
  for update using (auth.uid() = user_id);

-- 3) 랭킹 조회용 뷰 — 오늘/이번주/전체기간/순수작업시간(=전체기간) 은 닉네임+합산시간, 연속작업일수는 닉네임+streak를 정렬된 형태로 제공
--    클라이언트는 이 뷰들을 select 하기만 하면 되고, 정렬·집계는 DB에서 처리됨
create or replace view public.ranking_today as
  select p.nickname, d.total_seconds, d.user_id
  from public.daily_totals d
  join public.profiles p on p.user_id = d.user_id
  where d.date = current_date
  order by d.total_seconds desc;

create or replace view public.ranking_week as
  select p.nickname, sum(d.total_seconds)::bigint as total_seconds, p.user_id
  from public.daily_totals d
  join public.profiles p on p.user_id = d.user_id
  where d.date >= current_date - interval '6 days'
  group by p.user_id, p.nickname
  order by total_seconds desc;

create or replace view public.ranking_alltime as
  select p.nickname, sum(d.total_seconds)::bigint as total_seconds, p.user_id
  from public.daily_totals d
  join public.profiles p on p.user_id = d.user_id
  group by p.user_id, p.nickname
  order by total_seconds desc;

-- "순수 작업시간" 랭킹은 위 ranking_alltime 뷰를 그대로 재사용합니다 (전체 기간 누적 작업시간 = 순수 작업시간으로 정의).

-- 4) 연속 작업일수(streak) 랭킹 — 클라이언트가 자체 계산한 현재 연속일수를 profiles.current_streak에 주기적으로 반영
create or replace view public.ranking_streak as
  select nickname, current_streak, user_id
  from public.profiles
  where current_streak > 0
  order by current_streak desc;

grant select on public.ranking_today, public.ranking_week, public.ranking_alltime, public.ranking_streak
  to anon, authenticated;
```

> 이 스키마는 **캐주얼 랭킹**을 전제로 설계되었습니다. 누구나 자기 자신의 `daily_totals` 행을 자유롭게 쓸 수 있고(이미 앱에 있는 "개발자 모드"로 시간을 직접 편집할 수 있는 것과 동일한 신뢰 모델), 별도의 부정행위 검증 로직은 포함하지 않습니다. 앱의 랭킹 화면에도 "참고용 캐주얼 랭킹" 안내 문구가 표시됩니다.

## 3. 익명(게스트) 로그인 활성화

이메일/비밀번호 가입 대신 **버튼 한 번으로 시작하는 게스트 로그인**을 사용합니다 — 비밀번호 분실, 이메일 발송 설정, 계정 보안 관리를 신경 쓸 필요가 없고, 이메일 자체를 수집하지 않아 개인정보 처리 부담도 없습니다.

대시보드 **Authentication → Sign In / Providers**에서:
- **Anonymous Sign-Ins** 토글을 켭니다. (이 토글이 꺼져 있으면 앱의 "게스트로 시작하기" 버튼이 동작하지 않습니다.)
- 남용 방지를 위해 IP당 시간당 요청 횟수 제한이 기본 적용됩니다(기본 30회/시간). 필요하면 같은 화면에서 조정할 수 있습니다.

> 게스트 계정은 이메일 없이 즉시 생성되는 익명 계정입니다. 발급된 토큰에는 `is_anonymous: true` 클레임이 포함되며, 앱은 이 계정에 닉네임만 연결해 랭킹에 사용합니다.

## 4. 앱 코드에 URL / anon key 반영

`renderer/renderer.js` 상단의 아래 placeholder를 1번에서 확보한 값으로 교체합니다 (자동 업데이트 기능의 `<GITHUB_USER>/<GITHUB_REPO>` placeholder와 동일한 패턴입니다).

```js
const SUPABASE_URL = '<SUPABASE_PROJECT_URL>';
const SUPABASE_ANON_KEY = '<SUPABASE_ANON_KEY>';
```

교체 후 앱을 재시작하면 게스트 로그인/랭킹 기능이 실제 Supabase 프로젝트와 연동되어 동작합니다.

## 5. (선택) 관리자 기능 설정 — 전체 사용자 랭킹 초기화

개발/테스트 중 쌓인 더미 기록을 정리하거나, 운영 중 전체 랭킹을 초기 상태로 되돌리고 싶을 때를 위한 **관리자 전용** 기능입니다. **본인(개발자)만 사용하는 1회성 설정**이므로, 필요 없다면 이 단계는 건너뛰어도 앱의 다른 기능에는 전혀 영향이 없습니다.

클라이언트(게스트 계정)는 RLS상 본인 행만 수정할 수 있으므로, 전체 데이터를 다루는 작업은 **호출자가 관리자인지 서버에서 직접 검증하는 함수**를 통해서만 가능하게 만듭니다 — service role key를 앱에 내장하거나 RLS를 모두에게 풀어주는 위험한 방식은 사용하지 않습니다.

대시보드 **SQL Editor**에서 아래 SQL을 실행합니다 (`'내닉네임'` 부분은 본인의 실제 게스트 닉네임으로 바꿔서 실행하세요):

```sql
-- 1) 관리자 플래그 컬럼 추가
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- 2) 본인 계정을 관리자로 지정 — '내닉네임'을 실제 본인 닉네임으로 교체
update public.profiles set is_admin = true where nickname = '내닉네임';

-- 3) 전체 랭킹 초기화 함수 — SECURITY DEFINER로 RLS를 우회해 동작하지만,
--    내부에서 호출자가 관리자(is_admin)인지 직접 재검증하므로 비관리자가 호출하면 거부됩니다.
create or replace function public.admin_reset_all_rankings()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_admin) then
    raise exception 'forbidden';
  end if;
  delete from public.daily_totals;
  update public.profiles set current_streak = 0;
end;
$$;

-- 4) 누구나 "호출 시도"는 가능하지만, 통과는 관리자만 가능합니다 (위 3번의 검사 때문)
grant execute on function public.admin_reset_all_rankings() to authenticated;
```

설정이 끝나면 앱을 재시작한 뒤 본인 계정으로 게스트 로그인 → F12로 개발자 모드를 열면 "관리자: 전체 사용자 랭킹 초기화" 섹션이 나타납니다 (관리자로 지정된 계정에서만 보입니다).

## 5. 랭킹 항목별 초기화 (선택)

"오늘 / 이번 주 / 전체기간·순수작업시간 / 연속작업일수" 랭킹을 개별적으로 초기화하고 싶다면 아래 SQL을 추가로 실행합니다.

> ⚠ 오늘 ⊂ 이번 주 ⊂ 전체기간 관계로 같은 `daily_totals` 데이터를 날짜 범위만 다르게 집계한 것이라, 완전히 독립적인 초기화는 불가능합니다. 더 넓은 범위를 초기화하면 그 안에 포함된 좁은 범위의 기록도 함께 삭제되는 계층적 동작입니다 (예: "전체기간 초기화" → 오늘·이번 주 데이터도 함께 삭제됨).

```sql
-- 오늘 랭킹 초기화 — 오늘 날짜의 daily_totals 기록만 삭제
create or replace function public.admin_reset_ranking_today()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_admin) then
    raise exception 'forbidden';
  end if;
  delete from public.daily_totals where date = current_date;
end;
$$;
grant execute on function public.admin_reset_ranking_today() to authenticated;

-- 이번 주 랭킹 초기화 — 최근 7일(오늘 포함) daily_totals 기록 삭제
create or replace function public.admin_reset_ranking_week()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_admin) then
    raise exception 'forbidden';
  end if;
  delete from public.daily_totals where date >= current_date - interval '6 days';
end;
$$;
grant execute on function public.admin_reset_ranking_week() to authenticated;

-- 전체기간/순수작업시간 랭킹 초기화 — daily_totals 전체 삭제 (스트릭은 별도이므로 건드리지 않음)
create or replace function public.admin_reset_ranking_alltime()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_admin) then
    raise exception 'forbidden';
  end if;
  delete from public.daily_totals;
end;
$$;
grant execute on function public.admin_reset_ranking_alltime() to authenticated;

-- 연속작업일수 랭킹 초기화 — 전체 사용자의 streak만 0으로
create or replace function public.admin_reset_ranking_streak()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_admin) then
    raise exception 'forbidden';
  end if;
  update public.profiles set current_streak = 0;
end;
$$;
grant execute on function public.admin_reset_ranking_streak() to authenticated;
```

실행 후 앱을 재시작하면 개발자 모드의 "관리자: 랭킹 항목별 초기화" 섹션에서 각 항목을 개별적으로 초기화할 수 있습니다.

## 참고: 비용

무료 티어 기준 50,000 MAU(월간 활성 사용자), 500MB DB, 5GB 대역폭/월이 제공됩니다. 개인 프로젝트가 공개로 풀려서 어느 정도 사용자가 늘어나도 한동안 비용이 들지 않으며, 이 한도를 초과할 정도로 커지면 그때 유료 플랜(Pro, 월 $25~)으로 전환을 고려하면 됩니다.
