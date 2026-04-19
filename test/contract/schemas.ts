/**
 * Contract-test schema re-exports.
 *
 * The runtime registers these same shapes as MCP tool `outputSchema`s, so
 * keeping a single source of truth in `src/schemas.ts` means a contract drift
 * is reported by both layers (vitest contract suite + the SDK's
 * `validateToolOutput` step in production).
 */

export {
  commentSchema,
  commentsResponseSchema,
  feedSchema,
  ORDERING_VALUES,
  POST_TYPE_VALUES,
  postItemSchema,
  postResponseSchema,
  searchTagsResponseSchema,
  searchUsersResponseSchema,
  TAG_GROUP_VALUES,
  userAchievementsResponseSchema,
  userBadgesResponseSchema,
  userResponseSchema,
  userSchema,
  userTagsResponseSchema,
} from "../../src/schemas";
