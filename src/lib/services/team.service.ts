/**
 * Team Service Layer
 *
 * Handles all team-related business logic including member management,
 * invitations, and role updates. This service contains pure business logic
 * with no authentication or authorization checks (caller's responsibility).
 *
 * @module lib/services/team.service
 */

import { INVITATION_CONFIG } from '@/lib/auth/constants';
import type { TeamRole } from '@/lib/auth/permissions';
import { getUserRole } from '@/lib/auth/permissions';
import type { Database } from '@/lib/db/client';
import { db } from '@/lib/db/client';
import { teamInvitations, teamMembers, user } from '@/lib/db/schema';
import { ValidationError } from '@/lib/errors';
import { and, asc, eq } from 'drizzle-orm';
import crypto from 'node:crypto';

// Type definitions
export interface TeamMember {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: Date;
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: string;
  invitedBy: string;
  // SECURITY: Token should NOT be included in API responses
  // It should only be sent via secure email channel
  status: string;
  expiresAt: Date;
  createdAt: Date;
  acceptedAt: Date | null;
}

export interface CreateInvitationParams {
  teamId: string;
  email: string;
  role: 'member' | 'admin' | 'viewer';
  invitedBy: string;
}

export interface AcceptInvitationParams {
  token: string;
  userId: string;
}

export interface RemoveMemberParams {
  teamId: string;
  userId: string;
  requestingUserId: string;
}

export interface UpdateMemberRoleParams {
  teamId: string;
  userId: string;
  newRole: TeamRole;
  requestingUserId: string;
}

/**
 * Team Service Class
 *
 * Provides business logic for team operations. All methods assume
 * the caller has already verified authentication and authorization.
 */
export class TeamService {
  constructor(private database: Database = db) {}

  /**
   * Create a team invitation
   *
   * @param params - Invitation parameters
   * @throws {ValidationError} If email already has pending invitation or is already a member
   * @throws {Error} If database operation fails
   * @returns The created invitation
   */
  async createInvitation(
    params: CreateInvitationParams
  ): Promise<TeamInvitation> {
    // Check if email is already a team member
    const existingAuthUser = await this.database.query.user.findFirst({
      where: eq(user.email, params.email),
      columns: { id: true },
    });

    if (existingAuthUser) {
      const existingMember = await this.database.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, params.teamId),
          eq(teamMembers.userId, existingAuthUser.id)
        ),
        columns: { userId: true },
      });

      if (existingMember) {
        throw new ValidationError('User is already a team member');
      }
    }

    // Check if there's already a pending invitation
    const existingInvitation =
      await this.database.query.teamInvitations.findFirst({
        where: and(
          eq(teamInvitations.teamId, params.teamId),
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
    const [invitation] = await this.database
      .insert(teamInvitations)
      .values({
        teamId: params.teamId,
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
    // await this.emailService.sendInvitation(params.email, token);
    console.log(
      `[TeamService] Invitation created for ${params.email}. Token should be sent via email.`
    );

    // SECURITY: Do NOT return token in response
    // Token should only be sent via secure email channel
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
   * Accept a team invitation
   *
   * @param params - Acceptance parameters
   * @throws {ValidationError} If invitation is invalid, expired, or user is already a member
   * @throws {Error} If database operation fails
   * @returns The team ID the user joined
   */
  async acceptInvitation(params: AcceptInvitationParams): Promise<string> {
    // Get invitation
    const invitation = await this.database.query.teamInvitations.findFirst({
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
      await this.database
        .update(teamInvitations)
        .set({ status: 'expired' })
        .where(eq(teamInvitations.id, invitation.id));

      throw new ValidationError('Invitation has expired');
    }

    // Check if user is already a member
    const existingMember = await this.database.query.teamMembers.findFirst({
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
    await this.database.insert(teamMembers).values({
      teamId: invitation.teamId,
      userId: params.userId,
      role: invitation.role,
    });

    // Mark invitation as accepted
    try {
      await this.database
        .update(teamInvitations)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
        })
        .where(eq(teamInvitations.id, invitation.id));
    } catch (error) {
      console.error('[TeamService] Failed to update invitation status:', error);
      // Don't throw - user is already added to team
    }

    return invitation.teamId;
  }

  /**
   * Remove a member from a team
   *
   * @param params - Removal parameters
   * @throws {ValidationError} If user is not a member, is the owner, or trying to remove self
   * @throws {Error} If database operation fails
   */
  async removeMember(params: RemoveMemberParams): Promise<void> {
    // Prevent removing yourself
    if (params.requestingUserId === params.userId) {
      throw new ValidationError('You cannot remove yourself from the team');
    }

    // Get the target user's role
    const targetRole = await getUserRole(params.userId, params.teamId);
    if (!targetRole) {
      throw new ValidationError('User is not a member of this team');
    }

    // Prevent removing the owner
    if (targetRole === 'owner') {
      throw new ValidationError('Cannot remove the team owner');
    }

    // Remove the member
    await this.database
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, params.teamId),
          eq(teamMembers.userId, params.userId)
        )
      );
  }

  /**
   * Update a team member's role
   *
   * @param params - Role update parameters
   * @throws {ValidationError} If user is not a member, is owner, or trying to change own role
   * @throws {Error} If database operation fails
   */
  async updateMemberRole(params: UpdateMemberRoleParams): Promise<void> {
    // Prevent changing your own role
    if (params.requestingUserId === params.userId) {
      throw new ValidationError('You cannot change your own role');
    }

    // Get the target user's current role
    const currentRole = await getUserRole(params.userId, params.teamId);
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
    await this.database
      .update(teamMembers)
      .set({ role: params.newRole })
      .where(
        and(
          eq(teamMembers.teamId, params.teamId),
          eq(teamMembers.userId, params.userId)
        )
      );
  }

  /**
   * Get all members of a team
   *
   * @param teamId - The team ID
   * @throws {Error} If database operation fails
   * @returns Array of team members with their details
   */
  async getMembers(teamId: string): Promise<TeamMember[]> {
    const members: TeamMember[] = await this.database
      .select({
        userId: teamMembers.userId,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
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
      fullName: m.fullName,
      avatarUrl: m.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * Get all invitations for a team
   *
   * @param teamId - The team ID
   * @throws {Error} If database operation fails
   * @returns Array of team invitations
   */
  async getInvitations(
    teamId: string
  ): Promise<Omit<TeamInvitation, 'token'>[]> {
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
}

// Singleton instance
export const teamService = new TeamService();
