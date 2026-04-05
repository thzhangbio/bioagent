import {
  prependNormalizedKbMetadata,
} from "../../../kb-metadata.js";
import {
  buildKbArchiveFilenamePartsFromKbMetadata,
} from "../../../kb-archive-filename.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut10MetadataFetchStage: SegmentInboxToOutStage = {
  name: "10-metadata-fetch",
  async run(context) {
    const finalMd = await prependNormalizedKbMetadata(context.cleanedBody ?? "", {
      fetchCrossref: !context.options.noCrossref,
      fetchEuropePmc: !context.options.noEuropepmc,
      doiFallbackFromBasename: context.options.rawMd,
    });
    const archiveNameParts = buildKbArchiveFilenamePartsFromKbMetadata(
      finalMd,
      context.options.rawMd,
    );
    return appendSegmentInboxToOutNote(
      {
        ...context,
        finalMd,
        archiveNameParts,
      },
      "10-metadata-fetch: prepended normalized KB metadata and archive name parts.",
    );
  },
};
