export type RedemptionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Reward {
  id: string;
  name: string;
  pointsCost: number;
  imageUrl: string | null;
  active: boolean;
  order: number;
}

export interface RewardBalance {
  userId: string;
  earned: number;
  approvedSpent: number;
  pendingSpent: number;
  available: number;
}

export interface RedemptionUser {
  id: string;
  name: string;
  avatar: string | null;
  color: string | null;
}

export interface Redemption {
  id: string;
  rewardId: string | null;
  userId: string;
  rewardName: string;
  pointsCost: number;
  status: RedemptionStatus;
  requestedAt: string;
  decidedAt: string | null;
  user: RedemptionUser;
}

export interface CreateRewardInput {
  name: string;
  pointsCost: number;
  imageUrl?: string;
}

export function useRewards() {
  const requestFetch = useRequestFetch();

  const { data: rewards, refresh: refreshRewards } = useAsyncData(
    "rewards",
    () => requestFetch<Reward[]>("/api/rewards"),
    { default: () => [], server: false },
  );
  const { data: balances, refresh: refreshBalances } = useAsyncData(
    "reward-balances",
    () => requestFetch<RewardBalance[]>("/api/rewards/balances"),
    { default: () => [], server: false },
  );
  const { data: redemptions, refresh: refreshRedemptions } = useAsyncData(
    "redemptions",
    () => requestFetch<Redemption[]>("/api/redemptions"),
    { default: () => [], server: false },
  );

  const balanceByUser = computed(() => {
    const map: Record<string, RewardBalance> = {};
    for (const b of balances.value ?? []) map[b.userId] = b;
    return map;
  });

  async function refreshAll() {
    await Promise.all([refreshRewards(), refreshBalances(), refreshRedemptions()]);
  }

  // Mutations throw on 400/409 so the page can surface "not enough points" etc.
  async function redeem(rewardId: string) {
    await $fetch(`/api/rewards/${rewardId}/redeem`, { method: "POST" });
    await refreshAll();
  }
  async function createReward(input: CreateRewardInput) {
    await $fetch("/api/rewards", { method: "POST", body: input });
    await refreshAll();
  }
  async function updateReward(id: string, input: Partial<CreateRewardInput> & { active?: boolean }) {
    await $fetch(`/api/rewards/${id}`, { method: "PUT", body: input });
    await refreshAll();
  }
  async function deleteReward(id: string) {
    await $fetch(`/api/rewards/${id}`, { method: "DELETE" });
    await refreshAll();
  }
  async function approve(id: string) {
    await $fetch(`/api/redemptions/${id}/approve`, { method: "POST" });
    await refreshAll();
  }
  async function reject(id: string) {
    await $fetch(`/api/redemptions/${id}/reject`, { method: "POST" });
    await refreshAll();
  }

  return {
    rewards,
    balances,
    balanceByUser,
    redemptions,
    refreshAll,
    redeem,
    createReward,
    updateReward,
    deleteReward,
    approve,
    reject,
  };
}
