import { Event } from "@finances/types";
import { math } from "@finances/utils";

import { Forms } from "../types";

export const f1040s3 = (vmEvents: Event[], oldForms: Forms): Forms => {
  const forms = JSON.parse(JSON.stringify(oldForms)) as Forms;
  const { f1040, f1040s3 } = forms;

  f1040s3.FullName = `${f1040.FirstNameMI} ${f1040.LastName}`;
  f1040s3.SSN = f1040.SocialSecurityNumber;

  f1040s3.L7 = math.add(
    f1040s3.L1, f1040s3.L2, f1040s3.L3,
    f1040s3.L4, f1040s3.L5, f1040s3.L6,
  ); 

  f1040s3.L14 = math.add(
    f1040s3.L8, f1040s3.L9, f1040s3.L10,
    f1040s3.L11, f1040s3.L12, f1040s3.L13,
  ); 

  f1040.L13b = f1040s3.L7;
  f1040.L18d = f1040s3.L14;

  return { ...forms, f1040, f1040s3 };
};
