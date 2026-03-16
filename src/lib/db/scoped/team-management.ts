/**
 * Scoped Team Management Sub-module
 * Team-scoped member management, invitations, and role updates.
 */

import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '@/lib/db/client';
import { INVITATION_CONFIG } from '@/lib/auth/constants';
import type { TeamRole } from '@/lib/auth/permissions';
import { getUserRole } from '@/lib/auth/permissions';
import { teamInvitations, teamMembers, user } from '@/lib/db/schema';
import { ValidationError } from '@/lib/errors';
import crypto from 'node:crypto';

type TeamMember = {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  role: string;
  joinedAt: Date;
};

type TeamInvitation = {
  id: string;
  teamId: string;
  email: string;
  role: string;
  invitedBy: string;
  status: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
};

type CreateInvitationParams = {
  email: string;
  role: 'member' | 'admin' | 'viewer';
  invitedBy: string;
};

type AcceptInvitationParams = {
  token: string;
  userId: string;
};

type RemoveMemberParams = {
  userId: string;
  requestingUserId: string;
};

type UpdateMemberRoleParams = {
  userId: string;
  newRole: TeamRole;
  requestingUserId: string;
};

export function createTeamManagementMethods(db: Database, teamId: string) {
  /**
   * Create a team invitation.
   * @throws {ValidationError} If email already has pending invitation or is already a member
   */
  async function createInvitation(
    params: CreateInvitationParams
  ): Promise<TeamInvitation> {
    // Check if email is already a team member
    const existingAuthUser = await db.query.user.findFirst({
      where: eq(user.email, params.email),
      columns: { id: true },
    });

    if (existingAuthUser) {
      const existingMember = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, existingAuthUser.id)
        ),
        columns: { userId: true },
      });

      if (existingMember) {
        throw new ValidationError('User is already a team member');
      }
    }

    // Check if there's already a pending invitation
    const existingInvitation = await db.query.teamInvitations.findFirst({
      where: and(
        eq(teamInvitations.teamId, teamId),
        eq(teamInvitations.email, params.email),
        eq(teamInvitations.status, 'pending')
      ),
      columns: { id: true },
    });

    if (existingInvitation) {
      throw new ValidationError(
        'An invitation has already been sent to this email'
      );
    }

    // Generate cryptographically secure, URL-safe invitation token
    const token = crypto
      .randomBytes(INVITATION_CONFIG.TOKEN_BYTES)
      .toString(INVITATION_CONFIG.TOKEN_ENCODING);

    // Calculate expiry date
    const expiresAt = new Date(
      Date.now() + INVITATION_CONFIG.EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    // Create invitation
    const [invitation] = await db
      .insert(teamInvitations)
      .values({
        teamId,
        email: params.email,
        role: params.role,
        invitedBy: params.invitedBy,
        token,
        expiresAt,
      })
      .returning();

    if (!invitation) {
      throw new Error('No invitation returned from database');
    }

    // TODO: Send invitation email with token
    // SECURITY: Token should ONLY be sent via email, never in API response
    console.log(
      `[TeamManagement] Invitation created for ${params.email}. Token should be sent via email.`
    );

    // SECURITY: Do NOT return token in response
    return {
      id: invitation.id,
      teamId: invitation.teamId,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invitedBy,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      acceptedAt: invitation.acceptedAt ?? null,
    };
  }

  /**
   * Accept a team invitation.
   * @throws {ValidationError} If invitation is invalid, expired, or user is already a member
   * @returns The team ID the user joined
   */
  async function acceptInvitation(
    params: AcceptInvitationParams
  ): Promise<string> {
    // Get invitation
    const invitation = await db.query.teamInvitations.findFirst({
      where: eq(teamInvitations.token, params.token),
    });

    if (!invitation) {
      throw new ValidationError('Invalid invitation token');
    }

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      throw new ValidationError('Invitation is no longer valid');
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      // Mark as expired
      await db
        .update(teamInvitations)
        .set({ status: 'expired' })
        .where(eq(teamInvitations.id, invitation.id));

      throw new ValidationError('Invitation has expired');
    }

    // Check if user is already a member
    const existingMember = await db.query.teamMembers.findFirst({
      where: and(
        eq(teamMembers.teamId, invitation.teamId),
        eq(teamMembers.userId, params.userId)
      ),
      columns: { userId: true },
    });

    if (existingMember) {
      throw new ValidationError('You are already a member of this team');
    }

    // Add user to team
    await db.insert(teamMembers).values({
      teamId: invitation.teamId,
      userId: params.userId,
      role: invitation.role,
    });

    // Mark invitation as accepted
    try {
      await db
        .update(teamInvitations)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
        })
        .where(eq(teamInvitations.id, invitation.id));
    } catch (error) {
      console.error(
        '[TeamManagement] Failed to update invitation status:',
        error
      );
      // Don't throw - user is already added to team
    }

    return invitation.teamId;
  }

  /**
   * Remove a member from the team.
   * @throws {ValidationError} If user is not a member, is the owner, or trying to remove self
   */
  async function removeMember(params: RemoveMemberParams): Promise<void> {
    // Prevent removing yourself
    if (params.requestingUserId === params.userId) {
      throw new ValidationError('You cannot remove yourself from the team');
    }

    // Get the target user's role
    const targetRole = await getUserRole(params.userId, teamId);
    if (!targetRole) {
      throw new ValidationError('User is not a member of this team');
    }

    // Prevent removing the owner
    if (targetRole === 'owner') {
      throw new ValidationError('Cannot remove the team owner');
    }

    // Remove the member
    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, params.userId)
        )
      );
  }

  /**
   * Update a team member's role.
   * @throws {ValidationError} If user is not a member, is owner, or trying to change own role
   */
  async function updateMemberRole(
    params: UpdateMemberRoleParams
  ): Promise<void> {
    // Prevent changing your own role
    if (params.requestingUserId === params.userId) {
      throw new ValidationError('You cannot change your own role');
    }

    // Get the target user's current role
    const currentRole = await getUserRole(params.userId, teamId);
    if (!currentRole) {
      throw new ValidationError('User is not a member of this team');
    }

    // Prevent changing from owner role (there should only be one owner)
    if (currentRole === 'owner') {
      throw new ValidationError(
        "Cannot change the owner's role. Transfer ownership first."
      );
    }

    // Update the role
    await db
      .update(teamMembers)
      .set({ role: params.newRole })
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, params.userId)
        )
      );
  }

  /** Get all members of the team. */
  async function getMembers(): Promise<TeamMember[]> {
    const members: TeamMember[] = await db
      .select({
        userId: teamMembers.userId,
        email: user.email,
        name: user.name,
        image: user.image,
        role: teamMembers.role,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(user, eq(teamMembers.userId, user.id))
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(asc(teamMembers.joinedAt));

    return members.map((m) => ({
      userId: m.userId,
      email: m.email,
      name: m.name,
      image: m.image,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /** Get all invitations for the team. */
  async function getInvitations(): Promise<Omit<TeamInvitation, 'token'>[]> {
    const invitations: Omit<TeamInvitation, 'token'>[] = await db
      .select({
        id: teamInvitations.id,
        teamId: teamInvitations.teamId,
        email: teamInvitations.email,
        role: teamInvitations.role,
        invitedBy: teamInvitations.invitedBy,
        status: teamInvitations.status,
        expiresAt: teamInvitations.expiresAt,
        createdAt: teamInvitations.createdAt,
        acceptedAt: teamInvitations.acceptedAt,
      })
      .from(teamInvitations)
      .where(eq(teamInvitations.teamId, teamId))
      .orderBy(asc(teamInvitations.createdAt));

    return invitations.map((inv) => ({
      id: inv.id,
      teamId: inv.teamId,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.invitedBy,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      acceptedAt: inv.acceptedAt ?? null,
    }));
  }

  return {
    createInvitation,
    acceptInvitation,
    removeMember,
    updateMemberRole,
    getMembers,
    getInvitations,
  };
}
