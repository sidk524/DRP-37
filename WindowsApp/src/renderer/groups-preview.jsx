// Temporary visual-QA harness for the Groups page — stubs window.tether so the
// page renders in a plain browser without Electron/Supabase. Not shipped.
import { createRoot } from "react-dom/client";
import "./styles/responsive.css";
import "./styles/Onboarding.css";
import "./styles/BlockerSetup.css";
import Groups from "./pages/Groups";

const groups = [
    { id: "g1", name: "Meals", memberCount: 2, inviteCode: "AB12CD3" },
    { id: "g2", name: "test", memberCount: 2, inviteCode: "67PJPBR2" },
    { id: "g3", name: "Study squad", memberCount: 5, inviteCode: "QQ99ZZ1" },
];

const leaderboard = [
    { userId: "u1", displayName: "Siddharth Kambli", lockedSeconds: 6300, focusPoints: 140, isCurrentUser: true },
    { userId: "u2", displayName: "Lakshay Bansal", lockedSeconds: 4080, focusPoints: 95, isCurrentUser: false },
    { userId: "u3", displayName: "Ada Lovelace", lockedSeconds: 3600, focusPoints: 80, isCurrentUser: false },
    { userId: "u4", displayName: "Grace Hopper", lockedSeconds: 1800, focusPoints: 40, isCurrentUser: false },
];

window.tether = {
    listGroups: async () => groups,
    getGroupLeaderboard: async () => ({ leaderboard, focusPointsAvailable: true }),
    createGroup: async ({ name }) => {
        const group = { id: `g${groups.length + 1}`, name, memberCount: 1, inviteCode: "NEW1234" };
        groups.push(group);
        return group;
    },
    joinGroup: async () => groups[0],
};

createRoot(document.getElementById("root")).render(<Groups onBack={() => {}} />);
