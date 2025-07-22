import { PreferredRole } from "../types/user";
import type { CreateUserFormData, ValidationErrors } from "../types/user";

export const validateTrainerName = (value: string): string | undefined => {
  if (!value.trim()) {
    return "トレーナー名は必須です。";
  }
  if (value.length > 50) {
    return "トレーナー名は50文字以内で入力してください。";
  }
  return undefined;
};

export const validateTwitterId = (value: string): string | undefined => {
  if (!value) {
    return undefined; // Optional field
  }

  const twitterPattern = /^@[a-zA-Z0-9_]{1,15}$/;
  if (!twitterPattern.test(value)) {
    return "Twitter IDは@マーク付きで1-15文字の英数字・アンダースコアで入力してください。";
  }

  return undefined;
};

export const validatePreferredRoles = (
  roles: PreferredRole[],
): string | undefined => {
  if (roles.length > 5) {
    return "希望ロールは最大5個まで選択できます。";
  }
  return undefined;
};

export const validateBio = (value: string): string | undefined => {
  if (value.length > 500) {
    return "ひとことは500文字以内で入力してください。";
  }
  return undefined;
};

export const validateFormData = (
  formData: CreateUserFormData,
): ValidationErrors => {
  const errors: ValidationErrors = {};

  const trainerNameError = validateTrainerName(formData.trainer_name);
  if (trainerNameError) {
    errors.trainer_name = trainerNameError;
  }

  const twitterIdError = validateTwitterId(formData.twitter_id);
  if (twitterIdError) {
    errors.twitter_id = twitterIdError;
  }

  const preferredRolesError = validatePreferredRoles(formData.preferred_roles);
  if (preferredRolesError) {
    errors.preferred_roles = preferredRolesError;
  }

  const bioError = validateBio(formData.bio);
  if (bioError) {
    errors.bio = bioError;
  }

  return errors;
};

export const hasValidationErrors = (errors: ValidationErrors): boolean => {
  return Object.keys(errors).length > 0;
};

export const formatTwitterId = (value: string): string => {
  // Remove @ if already present, then add it
  const cleanValue = value.replace(/^@/, "");
  return cleanValue ? `@${cleanValue}` : "";
};
