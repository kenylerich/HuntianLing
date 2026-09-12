/**
 * Requirement intake model exports.
 *
 * Intake records source conversations and documents first, then turns approved
 * candidates into formal board WorkItems. The board store owns persistence so
 * the browser UI, JSON API, and future AI analyzers use the same records.
 */

export type {
  IntakeAnalyzeInput,
  IntakeAnalyzeMode,
  IntakeApprovalInput,
  IntakeApprovalResult,
  IntakeCandidateFilter,
  IntakeCandidateId,
  IntakeCandidateRequirement,
  IntakeCandidateSourceRef,
  IntakeCandidateStatus,
  IntakeCandidateType,
  IntakeCandidateUpdateInput,
  IntakeClarifyingQuestion,
  IntakeFollowUpInput,
  IntakeMessage,
  IntakeMessageCreateInput,
  IntakeMessageKind,
  IntakeMktDraft,
  MktFollowUpField,
  IntakeMessageId,
  IntakeMessageRole,
  IntakeSession,
  IntakeSessionBundle,
  IntakeSessionCreateInput,
  IntakeSessionFilter,
  IntakeSessionId,
  IntakeSessionStatus,
  IntakeSessionUpdateInput,
  IntakeSourceChunk,
  IntakeSourceChunkId,
  IntakeSourceDocument,
  IntakeSourceDocumentCreateInput,
  IntakeSourceDocumentId,
  IntakeSourceKind,
  IntakeSourceParseStatus,
} from '../board/types.js';
