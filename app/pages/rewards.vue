<script setup lang="ts">
import type { CreateRewardInput, Redemption, Reward } from "~/composables/useRewards";

const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");
// Management actions (catalog edits, approve/reject) need a fresh parent PIN
// on the shared kiosk session; redeeming stays open to every member.
const { gate } = useAdminGate();
const { rewards, balanceByUser, redemptions, redeem, createReward, updateReward, deleteReward, approve, reject, refreshAll: refreshRewardData } = useRewards();
const { adjustments, createAdjustment, removeAdjustment } = useAdjustments();

// Member list for the adjustment picker (admins only use it, but the fetch
// is harmless for members).
const requestFetch = useRequestFetch();
const { data: users } = await useAsyncData(
  "rewards-users",
  () => requestFetch<{ id: string; name: string }[]>("/api/users"),
  { default: () => [], server: false },
);

const myAvailable = computed(() => balanceByUser.value[user.value?.id ?? ""]?.available ?? 0);
const pendingQueue = computed(() => (redemptions.value ?? []).filter(r => r.status === "PENDING"));
const myRequests = computed(() => (redemptions.value ?? []).filter(r => r.userId === user.value?.id));

const dialogOpen = ref(false);
const editing = ref<Reward | null>(null);
const message = ref("");

function canAfford(r: Reward) {
  return myAvailable.value >= r.pointsCost;
}
async function onRedeem(r: Reward) {
  message.value = "";
  try {
    await redeem(r.id);
    message.value = `Requested “${r.name}” — waiting for a parent to approve.`;
  }
  catch (err) {
    const e = err as { statusMessage?: string; data?: { statusMessage?: string } };
    message.value = e?.statusMessage || e?.data?.statusMessage || "Couldn't redeem that.";
  }
}
function addReward() {
  gate(() => {
    editing.value = null;
    dialogOpen.value = true;
  });
}
function editReward(r: Reward) {
  gate(() => {
    editing.value = r;
    dialogOpen.value = true;
  });
}
async function onSave(data: CreateRewardInput) {
  await gate(async () => {
    if (editing.value)
      await updateReward(editing.value.id, data);
    else await createReward(data);
  });
}
async function onDelete(id: string) {
  await gate(() => deleteReward(id));
}
async function onApprove(id: string) {
  message.value = "";
  try {
    await gate(() => approve(id));
  }
  catch (err) {
    const e = err as { statusMessage?: string; data?: { statusMessage?: string } };
    message.value = e?.statusMessage || e?.data?.statusMessage || "Couldn't approve that.";
  }
}
async function onReject(id: string) {
  await gate(() => reject(id));
}

function statusBadge(s: Redemption["status"]) {
  return s === "APPROVED" ? "success" : s === "REJECTED" ? "error" : "warning";
}

// --- Points adjustments (parent deductions/bonuses) ---
const adjUserId = ref("");
const adjDelta = ref(-10);
const adjReason = ref("");
const adjMsg = ref("");
const userOptions = computed(() => (users.value ?? []).map(u => ({ label: u.name, value: u.id })));
const myAdjustments = computed(() =>
  (adjustments.value ?? []).filter(a => a.userId === user.value?.id),
);

async function applyAdjustment() {
  adjMsg.value = "";
  const delta = Math.trunc(Number(adjDelta.value) || 0);
  if (!adjUserId.value || !delta || !adjReason.value.trim()) {
    adjMsg.value = "Pick a member, a non-zero amount, and a reason.";
    return;
  }
  await gate(async () => {
    await createAdjustment({
      userId: adjUserId.value,
      delta,
      reason: adjReason.value.trim(),
      localDate: isoToday(),
    });
    await refreshRewardData();
    adjReason.value = "";
  });
}
async function deleteAdjustment(id: string) {
  await gate(async () => {
    await removeAdjustment(id);
    await refreshRewardData();
  });
}
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-default bg-default py-4 sm:px-4">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold">
          Rewards
        </h1>
        <UBadge
          color="primary"
          variant="subtle"
          size="lg"
        >
          {{ myAvailable }} points to spend
        </UBadge>
      </div>
      <UButton
        v-if="isAdmin"
        icon="i-lucide-plus"
        label="Add reward"
        @click="addReward"
      />
    </div>

    <ClientOnly>
      <div class="mx-auto w-full max-w-5xl p-4">
        <!-- Admin: everyone's spendable balance at a glance -->
        <div
          v-if="isAdmin && (users ?? []).length"
          class="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-default px-3 py-2 text-sm"
        >
          <span class="font-semibold">Balances</span>
          <span
            v-for="u in users"
            :key="u.id"
            class="flex items-center gap-1 whitespace-nowrap"
          >
            {{ u.name }}
            <span class="font-medium">{{ balanceByUser[u.id]?.available ?? 0 }} pts</span>
          </span>
        </div>

        <p v-if="message" class="mb-3 text-sm text-muted">
          {{ message }}
        </p>

        <!-- Catalog -->
        <div v-if="rewards.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <UCard v-for="r in rewards" :key="r.id">
            <div class="flex flex-col gap-3">
              <img
                v-if="r.imageUrl"
                :src="r.imageUrl"
                :alt="r.name"
                class="h-32 w-full rounded-lg object-cover"
              >
              <div class="flex items-start justify-between gap-2">
                <p class="font-semibold">
                  {{ r.name }}
                </p>
                <UBadge color="neutral" variant="soft">
                  {{ r.pointsCost }} pts
                </UBadge>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  label="Redeem"
                  size="sm"
                  :disabled="!canAfford(r)"
                  @click="onRedeem(r)"
                />
                <span v-if="!canAfford(r)" class="text-xs text-muted">need {{ r.pointsCost - myAvailable }} more</span>
                <UButton
                  v-if="isAdmin"
                  icon="i-lucide-pencil"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  aria-label="Edit reward"
                  class="ml-auto"
                  @click="editReward(r)"
                />
              </div>
            </div>
          </UCard>
        </div>
        <div v-else class="py-12 text-center text-muted">
          No rewards yet{{ isAdmin ? " — add one to get started." : "." }}
        </div>

        <!-- Admin: approval queue -->
        <div v-if="isAdmin && pendingQueue.length" class="mt-8">
          <h2 class="mb-3 text-lg font-semibold">
            Pending requests
          </h2>
          <ul class="flex flex-col gap-2">
            <li
              v-for="req in pendingQueue"
              :key="req.id"
              class="flex items-center gap-3 rounded-lg border border-default p-3"
            >
              <UAvatar
                :src="req.user.avatar || undefined"
                :alt="req.user.name"
                size="sm"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">
                  {{ req.user.name }} wants <span class="font-semibold">{{ req.rewardName }}</span>
                </p>
                <p class="text-sm text-muted">
                  {{ req.pointsCost }} pts · has {{ balanceByUser[req.userId]?.available ?? 0 }} available
                </p>
              </div>
              <UButton
                label="Approve"
                color="primary"
                size="sm"
                @click="onApprove(req.id)"
              />
              <UButton
                label="Reject"
                color="neutral"
                variant="soft"
                size="sm"
                @click="onReject(req.id)"
              />
            </li>
          </ul>
        </div>

        <!-- Admin: points adjustments (deductions / bonuses) -->
        <div v-if="isAdmin" class="mt-8">
          <h2 class="mb-1 text-lg font-semibold">
            Points adjustments
          </h2>
          <p class="mb-3 text-sm text-muted">
            Take away points (e.g. −20 for fighting) or give a bonus. Affects
            spendable points only — never streaks or badges.
          </p>
          <div class="flex flex-wrap items-end gap-3 rounded-lg border border-default p-3">
            <div class="w-40 space-y-1">
              <label class="block text-xs font-medium text-muted">Member</label>
              <USelect
                v-model="adjUserId"
                :items="userOptions"
                option-attribute="label"
                value-attribute="value"
                placeholder="Who"
                class="w-full"
                :ui="{ base: 'w-full' }"
              />
            </div>
            <div class="w-28 space-y-1">
              <label class="block text-xs font-medium text-muted">Points (±)</label>
              <UInput
                v-model.number="adjDelta"
                type="number"
                class="w-full"
                :ui="{ base: 'w-full' }"
              />
            </div>
            <div class="min-w-48 flex-1 space-y-1">
              <label class="block text-xs font-medium text-muted">Reason</label>
              <UInput
                v-model="adjReason"
                placeholder="e.g. fighting"
                class="w-full"
                :ui="{ base: 'w-full' }"
                @keyup.enter="applyAdjustment"
              />
            </div>
            <UButton label="Apply" @click="applyAdjustment" />
          </div>
          <p v-if="adjMsg" class="mt-2 text-sm text-error">
            {{ adjMsg }}
          </p>
          <ul v-if="adjustments.length" class="mt-3 flex flex-col gap-2">
            <li
              v-for="a in adjustments"
              :key="a.id"
              class="flex items-center gap-3 rounded-lg border border-default p-3"
            >
              <UAvatar
                :src="a.user.avatar || undefined"
                :alt="a.user.name"
                size="sm"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">
                  {{ a.user.name }}
                  <span :class="a.delta < 0 ? 'text-error' : 'text-success'">
                    {{ a.delta > 0 ? `+${a.delta}` : a.delta }}
                  </span>
                  — {{ a.reason }}
                </p>
                <p class="text-xs text-muted">
                  {{ a.localDate }}<template v-if="a.createdBy">
                    · by {{ a.createdBy.name }}
                  </template>
                </p>
              </div>
              <UButton
                icon="i-lucide-trash"
                size="xs"
                variant="ghost"
                color="neutral"
                aria-label="Remove adjustment"
                @click="deleteAdjustment(a.id)"
              />
            </li>
          </ul>
        </div>

        <!-- Member: recent point changes (deductions show the reason) -->
        <div v-if="!isAdmin && myAdjustments.length" class="mt-8">
          <h2 class="mb-3 text-lg font-semibold">
            Recent point changes
          </h2>
          <ul class="flex flex-col gap-2">
            <li
              v-for="a in myAdjustments"
              :key="a.id"
              class="flex items-center justify-between gap-3 rounded-lg border border-default p-3"
            >
              <span>
                <span class="font-semibold" :class="a.delta < 0 ? 'text-error' : 'text-success'">
                  {{ a.delta > 0 ? `+${a.delta}` : a.delta }}
                </span>
                — {{ a.reason }}
              </span>
              <span class="text-sm text-muted">{{ a.localDate }}</span>
            </li>
          </ul>
        </div>

        <!-- Member: my requests -->
        <div v-if="!isAdmin && myRequests.length" class="mt-8">
          <h2 class="mb-3 text-lg font-semibold">
            My requests
          </h2>
          <ul class="flex flex-col gap-2">
            <li
              v-for="req in myRequests"
              :key="req.id"
              class="flex items-center justify-between gap-3 rounded-lg border border-default p-3"
            >
              <span>{{ req.rewardName }} <span class="text-sm text-muted">({{ req.pointsCost }} pts)</span></span>
              <UBadge :color="statusBadge(req.status)" variant="subtle">
                {{ req.status.toLowerCase() }}
              </UBadge>
            </li>
          </ul>
        </div>
        <!-- Badge management lives in Settings → Badges (parent unlock). -->
      </div>
      <template #fallback>
        <div class="p-4 text-muted">
          Loading rewards…
        </div>
      </template>
    </ClientOnly>

    <RewardDialog
      :is-open="dialogOpen"
      :reward="editing"
      @close="dialogOpen = false"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>
