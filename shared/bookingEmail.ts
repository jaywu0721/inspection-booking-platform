import { z } from "zod";

export const bookingEmailSchema = z
  .string()
  .trim()
  .refine(value => value === "" || z.string().email().safeParse(value).success, {
    message: "請填寫有效的 Email 信箱",
  });
