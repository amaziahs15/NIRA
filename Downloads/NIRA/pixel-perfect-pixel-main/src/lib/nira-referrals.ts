export interface ReferralResource {
  id: string;
  name: string;
  category: "counselling" | "legal_aid" | "shelter" | "healthcare";
  district: string;
  phone: string;
  address: string;
  description: string;
  hours: string;
}

export const REFERRAL_DIRECTORY: ReferralResource[] = [
  // Chennai
  {
    id: "chennai-sakhi",
    name: "Sakhi One Stop Centre — Chennai",
    category: "shelter",
    district: "Chennai",
    phone: "044-24350123 / 181",
    address: "Institute of Social Education, Shenoy Nagar, Chennai 600030",
    description: "24/7 integrated emergency shelter, medical assistance, psycho-social counselling and police facilitation under one roof.",
    hours: "24/7",
  },
  {
    id: "chennai-sneha",
    name: "Sneha Suicide Prevention Helpline",
    category: "counselling",
    district: "Chennai",
    phone: "044-24640050",
    address: "11, Park View Road, RA Puram, Chennai 600028",
    description: "Confidential emotional support and crisis intervention helpline available daily.",
    hours: "8:00 AM – 10:00 PM Daily",
  },
  {
    id: "chennai-dlsa",
    name: "District Legal Services Authority (DLSA)",
    category: "legal_aid",
    district: "Chennai",
    phone: "044-25342441 / 15100",
    address: "City Civil Court Buildings, High Court Campus, Chennai 600104",
    description: "Free legal representation, advice, and mediation support for women and vulnerable individuals.",
    hours: "10:00 AM – 5:00 PM (Mon–Fri)",
  },
  {
    id: "chennai-ywca",
    name: "YWCA Crisis Intervention Centre & Short Stay Home",
    category: "shelter",
    district: "Chennai",
    phone: "044-25324261",
    address: "1086, Poonamallee High Road, Chennai 600084",
    description: "Safe shelter, trauma support, and legal guidance for women in distress and their children.",
    hours: "24/7 Intake",
  },
  {
    id: "chennai-nimhans-tele",
    name: "Tele-MANAS Mental Health Support",
    category: "counselling",
    district: "Chennai",
    phone: "14416 / 1800 891 4416",
    address: "National Tele-Mental Health Programme (Tamil Nadu Centre)",
    description: "Toll-free 24/7 multi-language psychiatric and psychological emergency assistance.",
    hours: "24/7",
  },

  // Coimbatore
  {
    id: "cbe-sakhi",
    name: "Sakhi One Stop Centre — Coimbatore",
    category: "shelter",
    district: "Coimbatore",
    phone: "0422-2300181 / 181",
    address: "CMCH Campus, Trichy Road, Coimbatore 641018",
    description: "Emergency shelter, medical triage, legal aid and counselling for women facing violence.",
    hours: "24/7",
  },
  {
    id: "cbe-dlsa",
    name: "Coimbatore District Legal Services Authority",
    category: "legal_aid",
    district: "Coimbatore",
    phone: "0422-2380120",
    address: "Combined Court Building, Coimbatore 641018",
    description: "Free legal advocacy, protection order assistance, and victim compensation facilitation.",
    hours: "10:00 AM – 5:00 PM (Mon–Sat)",
  },

  // Madurai
  {
    id: "mdu-sakhi",
    name: "Sakhi One Stop Centre — Madurai",
    category: "shelter",
    district: "Madurai",
    phone: "0452-2530181 / 181",
    address: "Government Rajaji Hospital Complex, Madurai 625020",
    description: "Temporary shelter, trauma support, medical examination and police liaison.",
    hours: "24/7",
  },
  {
    id: "mdu-dlsa",
    name: "Madurai District Legal Services Authority",
    category: "legal_aid",
    district: "Madurai",
    phone: "0452-2533355",
    address: "District Court Complex, Melur Road, Madurai 625020",
    description: "Legal advice and courtroom representation at zero charge for qualified applicants.",
    hours: "10:00 AM – 5:00 PM (Mon–Fri)",
  },
];
