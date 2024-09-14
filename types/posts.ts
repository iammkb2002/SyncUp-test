import { Organizations } from "@/types/organizations";
import { CombinedUserData } from "@/types/combined_user_data";

export interface Posts {
  postid: string;
  organizationid: string;
  authorid: string;
  content?: string;
  selectedRoles?: string[];
  selectedMemberships?: string[];
  createdat?: string;
  organizations?: Organizations;
  combined_user_data?: CombinedUserData;
  roles?: string[];
  memberships?: string[];
  postphoto?: string;
  postphotos?: string[];
}
