import { prisma } from '../db';
import { addPoints } from './points';
import { INVITE_MILESTONES } from './milestones';

/**
 * 检查并发放邀请阶梯奖励
 * 在邀请码兑换成功后调用。以 point_transactions(type='invite_milestone', reference_id=里程碑人数)
 * 做幂等判重，同一里程碑只发放一次。
 *
 * 已知限制：极端并发下（同一邀请人的两个兑换请求同时通过判重检查）同一里程碑可能重复发放，
 * 影响仅限多发积分，MVP 阶段可接受。
 *
 * @returns 本次新达成的里程碑名称列表
 */
export async function checkInviteMilestones(inviterId: number): Promise<string[]> {
  const awarded: string[] = [];

  const totalInvites = await prisma.invitation_records.count({
    where: { inviter_id: inviterId }
  });

  for (const milestone of INVITE_MILESTONES) {
    if (totalInvites < milestone.count) continue;

    const existing = await prisma.point_transactions.findFirst({
      where: {
        user_id: inviterId,
        type: 'invite_milestone',
        reference_id: milestone.count,
      }
    });
    if (existing) continue;

    await addPoints(
      inviterId,
      milestone.reward,
      'invite_milestone',
      `邀请满 ${milestone.count} 人奖励`,
      milestone.count
    );

    if (milestone.badge) {
      const user = await prisma.users.findUnique({
        where: { id: inviterId },
        select: { badges: true }
      });
      const badges: string[] = user?.badges ? JSON.parse(user.badges) : [];
      if (!badges.includes(milestone.badge.id)) {
        badges.push(milestone.badge.id);
        await prisma.users.update({
          where: { id: inviterId },
          data: { badges: JSON.stringify(badges) }
        });
      }
    }

    awarded.push(milestone.badge?.name ?? `邀请满${milestone.count}人`);
  }

  return awarded;
}
