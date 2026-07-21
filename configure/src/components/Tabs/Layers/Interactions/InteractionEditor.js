import React, { useEffect, useMemo, useState } from "react";
import { makeStyles } from "@mui/styles";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Button,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LockIcon from "@mui/icons-material/Lock";
import { DragDropContext, Draggable, Droppable } from "react-beautiful-dnd";

import { calls } from "../../../../core/calls";
import { reorderArray } from "../../../../core/utils";
import {
  getApplicableInteractions,
  getKindOptions,
  getKindPipeline,
  getSuppressionSources,
  interactionOrder,
  withClickPipeline,
} from "./interactionUtils";

const useStyles = makeStyles((theme) => ({
  editor: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },
  source: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
  },
  sourceButtons: {
    display: "flex",
    gap: theme.spacing(1),
  },
  preset: {
    minWidth: "240px",
    flex: 1,
  },
  pipeline: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  section: {
    paddingTop: "20px",
  },
  sectionLabel: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    color: theme.palette.swatches.p[12],
    fontSize: "12px !important",
    fontWeight: "bold !important",
    letterSpacing: "0.5px !important",
    textTransform: "uppercase",
  },
  item: {
    display: "flex",
    alignItems: "center",
    minHeight: "52px",
    padding: "10px",
    background: theme.palette.swatches.grey[900],
    border: `1px solid ${theme.palette.swatches.grey[800]}`,
  },
  itemSuppressed: {
    opacity: 0.55,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    color: theme.palette.swatches.grey[200],
    fontWeight: "bold !important",
  },
  itemDescription: {
    color: theme.palette.swatches.grey[400],
    fontSize: "12px !important",
  },
  interactionId: {
    color: theme.palette.swatches.grey[500],
    fontFamily: "monospace",
    fontSize: "11px !important",
  },
  dragHandle: {
    display: "flex",
    color: theme.palette.swatches.grey[500],
    marginRight: theme.spacing(1),
  },
  actions: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
  addRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },
  addPicker: {
    flex: 1,
  },
  empty: {
    padding: theme.spacing(2),
    color: theme.palette.swatches.grey[500],
    fontStyle: "italic",
    textAlign: "center",
  },
  divider: {
    borderColor: `${theme.palette.swatches.grey[800]} !important`,
  },
  accordion: {
    background: `${theme.palette.swatches.grey[950]} !important`,
  },
  pointerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: theme.spacing(2),
    width: "100%",
  },
}));

const InteractionItem = ({
  interaction,
  interactionId,
  dragHandleProps,
  onRemove,
  suppressedBy,
  c,
}) => {
  const name = interaction?.name || interactionId;
  return (
    <Paper
      className={`${c.item} ${suppressedBy ? c.itemSuppressed : ""}`}
      elevation={0}
    >
      {dragHandleProps ? (
        <div className={c.dragHandle} {...dragHandleProps}>
          <DragIndicatorIcon />
        </div>
      ) : (
        <LockIcon className={c.dragHandle} fontSize="small" />
      )}
      <div className={c.itemContent}>
        <Typography className={c.itemTitle}>
          {name}
          {suppressedBy ? (
            <Chip size="small" label={`Suppressed by ${suppressedBy}`} />
          ) : null}
        </Typography>
        <Typography className={c.interactionId}>{interactionId}</Typography>
        {interaction?.description ? (
          <Typography className={c.itemDescription}>
            {interaction.description}
          </Typography>
        ) : null}
      </div>
      {onRemove ? (
        <IconButton aria-label={`Remove ${name}`} onClick={onRemove}>
          <CloseIcon />
        </IconButton>
      ) : null}
    </Paper>
  );
};

const LockedPipeline = ({ title, interactions, suppressionSources, c }) => (
  <div className={`${c.pipeline} ${c.section}`}>
    <Typography className={c.sectionLabel}>
      <LockIcon fontSize="inherit" /> {title}
    </Typography>
    {interactions.length > 0 ? (
      interactions.map((interaction) => (
        <InteractionItem
          c={c}
          interaction={interaction}
          interactionId={interaction.interactionId}
          key={interaction.interactionId}
          suppressedBy={suppressionSources?.[interaction.interactionId]}
        />
      ))
    ) : (
      <div className={c.empty}>No interactions</div>
    )}
  </div>
);

export default function InteractionEditor({
  interactionConfigs: providedInteractionConfigs,
  layer,
  updateConfiguration,
}) {
  const c = useStyles();
  const [interactionConfigs, setInteractionConfigs] = useState(
    providedInteractionConfigs || null
  );
  const [loadError, setLoadError] = useState(false);
  const [interactionToAdd, setInteractionToAdd] = useState(null);

  useEffect(() => {
    if (providedInteractionConfigs) {
      setInteractionConfigs(providedInteractionConfigs);
      return;
    }
    calls.api(
      "getInteractionConfig",
      null,
      (configs) => setInteractionConfigs(configs),
      () => setLoadError(true)
    );
  }, [providedInteractionConfigs]);

  const configsById = useMemo(
    () =>
      Object.values(interactionConfigs || {}).reduce((byId, interaction) => {
        byId[interaction.interactionId] = interaction;
        return byId;
      }, {}),
    [interactionConfigs]
  );

  if (loadError)
    return <Alert severity="error">Failed to load interaction plugins.</Alert>;
  if (!interactionConfigs) return <Typography>Loading interactions…</Typography>;

  const customPipeline = Array.isArray(layer.interactions?.click);
  const kind = layer.kind || "none";
  const kindOptions = getKindOptions(interactionConfigs, layer.type);
  const kindAvailable = kindOptions.includes(kind);
  if (!kindAvailable) kindOptions.push(kind);

  const presetPipeline = getKindPipeline(interactionConfigs, layer.type, kind);
  const selectedIds = customPipeline
    ? layer.interactions.click
    : presetPipeline;
  const suppressionSources = getSuppressionSources(
    interactionConfigs,
    selectedIds
  );

  const clickPreamble = getApplicableInteractions(
    interactionConfigs,
    layer.type,
    "click",
    "preamble"
  ).sort(interactionOrder);
  const clickPostamble = getApplicableInteractions(
    interactionConfigs,
    layer.type,
    "click",
    "postamble"
  ).sort(interactionOrder);
  const availableMain = getApplicableInteractions(
    interactionConfigs,
    layer.type,
    "click",
    "main"
  ).sort((a, b) =>
    (a.name || a.interactionId).localeCompare(b.name || b.interactionId)
  );
  const availableToAdd = availableMain.filter(
    (interaction) => !selectedIds.includes(interaction.interactionId)
  );

  const invalidIds = selectedIds.filter((interactionId) => {
    const interaction = configsById[interactionId];
    return (
      interaction == null ||
      !getApplicableInteractions(
        interactionConfigs,
        layer.type,
        "click",
        "main"
      ).some((applicable) => applicable.interactionId === interactionId)
    );
  });
  const duplicateIds = selectedIds.filter(
    (interactionId, index) => selectedIds.indexOf(interactionId) !== index
  );

  const updateClickPipeline = (clickPipeline) => {
    updateConfiguration(
      "interactions",
      withClickPipeline(layer.interactions, clickPipeline),
      layer
    );
  };

  const hoverDefaults = getApplicableInteractions(
    interactionConfigs,
    layer.type,
    "hover",
    "preamble"
  ).sort(interactionOrder);
  const mouseoutDefaults = getApplicableInteractions(
    interactionConfigs,
    layer.type,
    "mouseout",
    "preamble"
  ).sort(interactionOrder);

  return (
    <div className={c.editor}>
      <div className={c.source}>
        <div>
          <Typography variant="h6">Behavior source</Typography>
          <Typography className={c.itemDescription}>
            Use a Kind preset or customize the ordered main click interactions.
          </Typography>
        </div>
        <div className={c.sourceButtons}>
          <Button
            variant={customPipeline ? "outlined" : "contained"}
            onClick={() => updateClickPipeline(null)}
          >
            Kind preset
          </Button>
          <Button
            variant={customPipeline ? "contained" : "outlined"}
            onClick={() => updateClickPipeline(presetPipeline)}
          >
            Customize pipeline
          </Button>
        </div>
      </div>

      <FormControl className={c.preset} variant="filled" size="small">
        <InputLabel>Kind of Layer</InputLabel>
        <Select
          disabled={customPipeline}
          value={kind}
          onChange={(event) =>
            updateConfiguration("kind", event.target.value, layer)
          }
        >
          {kindOptions.map((option) => (
            <MenuItem key={option} value={option}>
              {option.toUpperCase()}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {customPipeline ? (
        <Typography className={c.itemDescription}>
          The Kind preset remains saved for easy restoration but does not control
          the custom click pipeline.
        </Typography>
      ) : null}

      {!kindAvailable ? (
        <Alert severity="warning">
          The saved Kind “{kind}” is not provided by an enabled interaction
          plugin for this layer type.
        </Alert>
      ) : null}
      {invalidIds.length > 0 ? (
        <Alert severity="warning">
          Unavailable or inapplicable interactions: {invalidIds.join(", ")}.
          They remain in the layer configuration until removed.
        </Alert>
      ) : null}
      {duplicateIds.length > 0 ? (
        <Alert severity="warning">
          Duplicate interactions are not allowed: {duplicateIds.join(", ")}.
        </Alert>
      ) : null}

      <Divider className={c.divider} />
      <LockedPipeline
        c={c}
        interactions={clickPreamble}
        title="Always before"
      />

      <div className={`${c.pipeline} ${c.section}`}>
        <Typography className={c.sectionLabel}>Main behavior</Typography>
        {customPipeline ? (
          <DragDropContext
            onDragEnd={(result) => {
              if (!result.destination) return;
              updateClickPipeline(
                reorderArray(
                  selectedIds,
                  result.source.index,
                  result.destination.index
                )
              );
            }}
          >
            <Droppable droppableId={`layer-${layer.uuid || "new"}-click`}>
              {(provided) => (
                <div
                  className={c.pipeline}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  {selectedIds.map((interactionId, index) => (
                    <Draggable
                      draggableId={`${interactionId}-${index}`}
                      index={index}
                      key={`${interactionId}-${index}`}
                    >
                      {(draggableProvided) => (
                        <div
                          ref={draggableProvided.innerRef}
                          {...draggableProvided.draggableProps}
                        >
                          <InteractionItem
                            c={c}
                            dragHandleProps={draggableProvided.dragHandleProps}
                            interaction={configsById[interactionId]}
                            interactionId={interactionId}
                            onRemove={() =>
                              updateClickPipeline(
                                selectedIds.filter(
                                  (_, removeIndex) => removeIndex !== index
                                )
                              )
                            }
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  {selectedIds.length === 0 ? (
                    <div className={c.empty}>No main click interactions</div>
                  ) : null}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : selectedIds.length > 0 ? (
          selectedIds.map((interactionId) => (
            <InteractionItem
              c={c}
              interaction={configsById[interactionId]}
              interactionId={interactionId}
              key={interactionId}
            />
          ))
        ) : (
          <div className={c.empty}>This Kind has no main interactions</div>
        )}
      </div>

      {customPipeline ? (
        <>
          <div className={c.addRow}>
            <Autocomplete
              className={c.addPicker}
              getOptionLabel={(interaction) =>
                `${interaction.name || interaction.interactionId} (${
                  interaction.interactionId
                })`
              }
              onChange={(_, interaction) => setInteractionToAdd(interaction)}
              options={availableToAdd}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Add interaction"
                  size="small"
                  variant="filled"
                />
              )}
              value={interactionToAdd}
            />
            <Button
              disabled={!interactionToAdd}
              onClick={() => {
                updateClickPipeline([
                  ...selectedIds,
                  interactionToAdd.interactionId,
                ]);
                setInteractionToAdd(null);
              }}
              startIcon={<AddIcon />}
              variant="outlined"
            >
              Add
            </Button>
          </div>
          <div className={c.actions}>
            <Button onClick={() => updateClickPipeline(presetPipeline)}>
              Reset to Kind preset
            </Button>
            <Button onClick={() => updateClickPipeline([])}>
              Clear custom pipeline
            </Button>
          </div>
        </>
      ) : null}

      <LockedPipeline
        c={c}
        interactions={clickPostamble}
        suppressionSources={suppressionSources}
        title="Always after"
      />

      <Accordion className={c.accordion} disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Pointer interactions (advanced)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <div className={c.pointerGrid}>
            <LockedPipeline
              c={c}
              interactions={hoverDefaults}
              title="Hover defaults"
            />
            <LockedPipeline
              c={c}
              interactions={mouseoutDefaults}
              title="Mouseout defaults"
            />
          </div>
        </AccordionDetails>
      </Accordion>
    </div>
  );
}
