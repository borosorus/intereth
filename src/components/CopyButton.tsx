import { Alert, Button, IconButton, Snackbar, Tooltip } from "@mui/material";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { useState } from "react";

interface CopyButtonProps {
    value: string;
    label: string;
    variant?: "icon" | "text" | "url";
    size?: "small" | "medium";
    disabled?: boolean;
}

export default function CopyButton({value, label, variant = "icon", size = "small", disabled = false}: CopyButtonProps) {
    const [copied, setCopied] = useState(false);
    const [copyError, setCopyError] = useState(false);

    const copy = async (event: React.MouseEvent) => {
        event.stopPropagation();
        if (disabled) return;
        try {
            if (!navigator.clipboard) {
                throw new Error("Clipboard API unavailable");
            }
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setCopyError(false);
        } catch {
            setCopied(false);
            setCopyError(true);
        }
    };

    const icon = copied ? <CheckIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />;

    return (
        <>
            {variant === "url" ? (
                <Tooltip title={copied ? "Copied" : label}>
                    <Button
                        size={size}
                        onClick={copy}
                        endIcon={icon}
                        aria-label={label}
                        disabled={disabled}
                        sx={{
                            width: 1,
                            minWidth: 0,
                            p: 0,
                            justifyContent: "flex-start",
                            textTransform: "none",
                            color: "text.secondary",
                            fontSize: "inherit",
                            lineHeight: "inherit",
                            "& .MuiButton-endIcon": {flex: "0 0 auto"},
                        }}
                    >
                        <span style={{overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{value}</span>
                    </Button>
                </Tooltip>
            ) : variant === "text" ? (
                <Button size={size} onClick={copy} startIcon={icon} disabled={disabled} sx={{textTransform: "none"}}>
                    {copied ? "Copied" : label}
                </Button>
            ) : (
                <Tooltip title={copied ? "Copied" : label}>
                    <IconButton size={size} onClick={copy} aria-label={label} disabled={disabled}>
                        {icon}
                    </IconButton>
                </Tooltip>
            )}
            <Snackbar open={copied} autoHideDuration={1800} onClose={() => setCopied(false)}>
                <Alert severity="success" variant="filled" onClose={() => setCopied(false)}>Copied to clipboard</Alert>
            </Snackbar>
            <Snackbar open={copyError} autoHideDuration={3000} onClose={() => setCopyError(false)}>
                <Alert severity="error" variant="filled" onClose={() => setCopyError(false)}>Clipboard access failed</Alert>
            </Snackbar>
        </>
    );
}
