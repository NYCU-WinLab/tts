import { createCn } from "cn/config"

// cn that knows the WinLab type scale. Stock tailwind-merge rules read
// text-title and text-body as colors, so cn("text-body", "text-foreground")
// would drop the size; registering them as font sizes keeps both.
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["title", "body"] }] } },
})
