import {
  FaBolt,
  FaBullhorn,
  FaChartLine,
  FaCog,
  FaFileAlt,
  FaInbox,
  FaProjectDiagram,
  FaTachometerAlt,
  FaUsers,
  FaWhatsapp,
} from "react-icons/fa";

export const navigationSections = [
  {
    title: "Operate",
    items: [
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: <FaTachometerAlt />,
        subtitle: "Live business overview",
      },
      {
        to: "/inbox",
        label: "Inbox",
        icon: <FaInbox />,
        subtitle: "Replies and handoffs",
      },
      {
        to: "/contacts",
        label: "Contacts",
        icon: <FaUsers />,
        subtitle: "Leads and audiences",
      },
      {
        to: "/campaigns",
        label: "Campaigns",
        icon: <FaBullhorn />,
        subtitle: "Broadcast planning",
      },
    ],
  },
  {
    title: "Build",
    items: [
      {
        to: "/templates",
        label: "Templates",
        icon: <FaFileAlt />,
        subtitle: "Meta message assets",
      },
      {
        to: "/message-flows",
        label: "Message Flows",
        icon: <FaProjectDiagram />,
        subtitle: "Automation journeys",
      },
    ],
  },
  {
    title: "Monitor",
    items: [
      {
        to: "/reports",
        label: "Reports",
        icon: <FaChartLine />,
        subtitle: "Delivery and analytics",
      },
      {
        to: "/whatsapp-setup",
        label: "WhatsApp Setup",
        icon: <FaCog />,
        subtitle: "Meta connection",
      },
    ],
  },
];

export const navItems = navigationSections.flatMap((section) => section.items);

export const routeMeta = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Campaign health, automation, inbox and Meta performance at a glance.",
  },
  "/contacts": {
    title: "Contacts",
    subtitle: "Import, organize and segment leads for targeted WhatsApp campaigns.",
  },
  "/campaigns": {
    title: "Campaigns",
    subtitle: "Create broadcasts, send tests and track delivery progress.",
  },
  "/templates": {
    title: "Templates",
    subtitle: "Build and sync approved Meta templates for reliable outreach.",
  },
  "/inbox": {
    title: "Inbox",
    subtitle: "Handle inbound replies, agent handoffs and customer follow-up.",
  },
  "/message-flows": {
    title: "Message Flows",
    subtitle: "Automate replies, delays, template sends and agent handoffs.",
  },
  "/reports": {
    title: "Reports",
    subtitle: "Review campaign performance, failures and engagement trends.",
  },
  "/whatsapp-setup": {
    title: "WhatsApp Setup",
    subtitle: "Connect Meta, configure webhook validation and confirm account readiness.",
  },
};

export const quickActions = [
  {
    label: "Create Campaign",
    to: "/campaigns",
    icon: <FaBullhorn />,
    description: "Start a broadcast",
  },
  {
    label: "Import Contacts",
    to: "/contacts",
    icon: <FaUsers />,
    description: "Add lead lists",
  },
  {
    label: "Open Inbox",
    to: "/inbox",
    icon: <FaInbox />,
    description: "Reply to customers",
  },
  {
    label: "Build Flow",
    to: "/message-flows",
    icon: <FaBolt />,
    description: "Automate follow-ups",
  },
  {
    label: "Connect WhatsApp",
    to: "/whatsapp-setup",
    icon: <FaWhatsapp />,
    description: "Meta setup",
  },
];
