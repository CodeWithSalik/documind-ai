"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  UserPlus,
  ShieldCheck,
  MoreVertical,
  Mail,
  Trash2,
  CheckCircle2,
  Clock,
  Shield,
  Eye,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { toast } from "@/components/shared/toast-provider";

type Role = "Owner" | "Admin" | "Member" | "Viewer";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: string;
  avatarText: string;
}

export default function TeamSettingsPage() {
  const [members, setMembers] = React.useState<TeamMember[]>([
    {
      id: "owner-1",
      name: "Workspace Owner (You)",
      email: "Active Account",
      role: "Owner",
      joinedAt: "Active",
      avatarText: "OW",
    },
  ]);

  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<Role>("Member");
  const [isInviting, setIsInviting] = React.useState(false);

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !/\S+@\S+\.\S+/.test(inviteEmail)) {
      toast.error("Please enter a valid collaborator email address.");
      return;
    }

    setIsInviting(true);
    setTimeout(() => {
      setIsInviting(false);
      toast.success(`Invitation sent to ${inviteEmail}`, {
        description: `Role assigned: ${inviteRole}. An email with instructions was dispatched.`,
      });
      setInviteEmail("");
    }, 600);
  };

  const handleRoleChange = (memberId: string, newRole: Role) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
    );
    toast.success("Team member role updated");
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.info("Collaborator removed", {
      description: `${memberName} no longer has access to this workspace.`,
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/settings">
          <Button variant="ghost" size="xs" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Back to Settings
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-foreground">
          Team Members & Role Governance
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Manage workspace members, invite collaborators, and define role-based access control (RBAC).
        </p>
      </div>

      {/* Invite Member Card */}
      <Card className="border-border/70 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserPlus className="size-4 text-primary" />
            Invite New Collaborator
          </CardTitle>
          <CardDescription className="text-xs">
            Send an invitation to join this workspace with specific permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@organization.com"
                className="pl-9 h-9 text-xs"
              />
            </div>

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary shrink-0"
            >
              <option value="Admin">Admin (Full Access)</option>
              <option value="Member">Member (Upload & Chat)</option>
              <option value="Viewer">Viewer (Read-Only)</option>
            </select>

            <Button type="submit" disabled={isInviting} className="h-9 gap-1.5 text-xs font-semibold shadow-xs">
              <UserPlus className="size-3.5" />
              {isInviting ? "Inviting..." : "Send Invite"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Active Team Members List */}
      <Card className="border-border/70 bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Active Members</CardTitle>
              <CardDescription className="text-xs">
                {members.length} seats active out of 10 allocated on your enterprise plan.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {members.length} / 10 Seats
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-colors text-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                  {member.avatarText}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate">{member.name}</span>
                    {member.role === "Owner" && (
                      <span className="rounded bg-primary/10 text-primary font-semibold text-[10px] px-1.5 py-0.2">
                        OWNER
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{member.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] text-muted-foreground hidden md:inline">
                  Joined {member.joinedAt}
                </span>

                {member.role !== "Owner" ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                    className="h-7 rounded-md border border-input bg-background px-2 text-[11px] outline-none"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Member">Member</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                ) : (
                  <Badge variant="outline" className="text-[11px]">
                    Owner
                  </Badge>
                )}

                {member.role !== "Owner" && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleRemoveMember(member.id, member.name)}
                    className="hover:text-destructive"
                    title="Remove member"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Role Permissions Matrix */}
      <Card className="border-border/70 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-500" />
            Role Permission Matrix
          </CardTitle>
          <CardDescription className="text-xs">
            Summary of capability tiers across workspace roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/70 text-muted-foreground font-semibold">
                  <th className="py-2.5 px-3">Permission</th>
                  <th className="py-2.5 px-3 text-center">Viewer</th>
                  <th className="py-2.5 px-3 text-center">Member</th>
                  <th className="py-2.5 px-3 text-center">Admin</th>
                  <th className="py-2.5 px-3 text-center">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-foreground">
                <tr>
                  <td className="py-2.5 px-3 font-medium">Read Documents & Threads</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Upload Documents & Ask AI Studio</td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">—</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Generate & Download Artifacts</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Configure AI Models & API Keys</td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">—</td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">—</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">Manage Team Members & Billing</td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">—</td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">—</td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">—</td>
                  <td className="py-2.5 px-3 text-center text-emerald-500">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
