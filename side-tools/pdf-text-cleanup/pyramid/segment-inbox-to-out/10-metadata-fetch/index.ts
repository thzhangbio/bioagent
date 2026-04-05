import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut10MetadataFetchStage: SegmentInboxToOutStage = {
  name: "10-metadata-fetch",
  run(context) {
    return appendSegmentInboxToOutNote(
      context,
      "10-metadata-fetch: root stage placeholder created.",
    );
  },
};

