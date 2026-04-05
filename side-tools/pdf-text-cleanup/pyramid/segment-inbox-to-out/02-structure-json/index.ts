import {
  formatStructureSectionForKb,
  listMineruStructure,
} from "../../../mineru-json-structure.js";
import {
  appendSegmentInboxToOutNote,
  type SegmentInboxToOutStage,
} from "../stage-shared.js";

export const segmentInboxToOut02StructureJsonStage: SegmentInboxToOutStage = {
  name: "02-structure-json",
  run(context) {
    let structureSection = "";
    if (context.rawJson !== undefined) {
      structureSection = formatStructureSectionForKb(
        listMineruStructure(context.rawJson),
      );
    }
    return appendSegmentInboxToOutNote(
      {
        ...context,
        structureSection,
      },
      "02-structure-json: built structure manifest block.",
    );
  },
};
