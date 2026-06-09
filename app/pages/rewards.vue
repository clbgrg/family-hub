<script setup lang="ts">
import type { BadgeDef, CreateBadgeInput } from "~/composables/useBadges";
import type { CreateRewardInput, Redemption, Reward } from "~/composables/useRewards";

import { BADGE_RULE_LABELS } from "~/composables/useBadges";

const { user } = useUserSession();
const isAdmin = computed(() => user.value?.role === "ADMIN");
const { rewards, balanceByUser, redemptions, redeem, createReward, updateReward, deleteReward, approve, reject } = useRewards();
const { badges, createBadge, updateBadge, deleteBadge } = useBadges();

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
  catch (e: any) {
    message.value = e?.statusMessage || e?.data?.statusMessage || "Couldn't redeem that.";
  }
}
function addReward() {
  editing.value = null;
  dialogOpen.value = true;
}
function editReward(r: Reward) {
  editing.value = r;
  dialogOpen.value = true;
}
async function onSave(data: CreateRewardInput) {
  if (editing.value) await updateReward(editing.value.id, data);
  else await createReward(data);
}
async function onDelete(id: string) {
  await deleteReward(id);
}
async function onApprove(id: string) {
  message.value = "";
  try {
    await approve(id);
  }
  catch (e: any) {
    message.value = e?.statusMessage || e?.data?.statusMessage || "Couldn't approve that.";
  }
}
async function onReject(id: string) {
  await reject(id);
}

function statusBadge(s: Redemption["status"]) {
  return s === "APPROVED" ? "success" : s === "REJECTED" ? "error" : "warning";
}

// --- Badges (admin) ---
const badgeDialogOpen = ref(false);
const editingBadge = ref<BadgeDef | null>(null);
function addBadge() {
  editingBadge.value = null;
  badgeDialogOpen.value = true;
}
function editBadge(b: BadgeDef) {
  editingBadge.value = b;
  badgeDialogOpen.value = true;
}
async function onBadgeSave(data: CreateBadgeInput) {
  if (editingBadge.value) await updateBadge(editingBadge.value.id, data);
  else await createBadge(data);
}
async function onBadgeDelete(id: string) {
  await deleteBadge(id);
}
</script>

<template>
  <div class="flex w-full flex-col">
    <div class="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-default bg-default py-4 sm:px-4">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold">
          Rewards
        </h1>
        <UBadge color="primary" variant="subtle" size="lg">
          {{ myAvailable }} points to spend
        </UBadge>
      </div>
      <UButton v-if="isAdmin" icon="i-lucide-plus" label="Add reward" @click="addReward" />
    </div>

    <ClientOnly>
      <div class="mx-auto w-full max-w-5xl p-4">
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
              <UAvatar :src="req.user.avatar || undefined" :alt="req.user.name" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">
                  {{ req.user.name }} wants <span class="font-semibold">{{ req.rewardName }}</span>
                </p>
                <p class="text-sm text-muted">
                  {{ req.pointsCost }} pts · has {{ balanceByUser[req.userId]?.available ?? 0 }} available
                </p>
              </div>
              <UButton label="Approve" color="primary" size="sm" @click="onApprove(req.id)" />
              <UButton label="Reject" color="neutral" variant="soft" size="sm" @click="onReject(req.id)" />
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

        <!-- Admin: badges -->
        <div v-if="isAdmin" class="mt-8">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-lg font-semibold">
              Badges
            </h2>
            <UButton icon="i-lucide-plus" label="Add badge" size="sm" @click="addBadge" />
          </div>
          <ul class="flex flex-col gap-2">
            <li
              v-for="b in badges"
              :key="b.id"
              class="flex items-center gap-3 rounded-lg border border-default p-3"
            >
              <UIcon :name="b.icon || 'i-lucide-award'" class="size-6 text-primary" />
              <div class="min-w-0 flex-1">
                <p class="truncate font-medium">
                  {{ b.name }}
                </p>
                <p class="text-sm text-muted">
                  {{ BADGE_RULE_LABELS[b.ruleType] }} {{ b.threshold }}
                </p>
              </div>
              <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" aria-label="Edit badge" @click="editBadge(b)" />
            </li>
          </ul>
        </div>
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

    <BadgeDialog
      :is-open="badgeDialogOpen"
      :badge="editingBadge"
      @close="badgeDialogOpen = false"
      @save="onBadgeSave"
      @delete="onBadgeDelete"
    />
  </div>
</template>
