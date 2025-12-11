"use strict";
// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Make sure that we're in Dev Mode and running codegen
if (figma.editorType === "dev" && figma.mode === "codegen") {
    // Register a callback to the "generate" event
    figma.codegen.on("generate", (_a) => __awaiter(void 0, [_a], void 0, function* ({ node }) {
        const outputs = yield GenerateFigmaStyles();
        let sections = [];
        outputs.forEach((code, file) => {
            sections.push({
                title: file,
                language: "PLAINTEXT",
                code: code
            });
        });
        return sections;
    }));
}
const XamlColors = 'StaticXamlColors.xaml';
const CsColors = 'StaticColors.cs';
const CsHexColors = 'HexColors.cs';
const XamlBrushes = 'StaticBrushes.xaml';
const XamlTextStyles = 'TextStyles.xaml';
function GenerateFigmaStyles() {
    return __awaiter(this, void 0, void 0, function* () {
        let outputs = new Map();
        let paintStyles = yield figma.getLocalPaintStylesAsync();
        paintStyles.sort((a, b) => a.name.localeCompare(b.name));
        paintStyles.forEach(paintStyle => {
            paintStyle.paints.forEach(paint => {
                // let name = (paint.blendMode != undefined) ? `${paintStyle.name}${camelize(paint.blendMode)}` : paintStyle.name;
                let name = fixName(paintStyle.name);
                if (paint.type === "SOLID") {
                    generateSolidColorResources(outputs, name, paint);
                }
                else if (paint.type === 'GRADIENT_LINEAR') {
                    generateGradientResources(outputs, name, paint);
                }
            });
        });
        let textStyles = yield figma.getLocalTextStylesAsync();
        textStyles.sort((a, b) => a.name.localeCompare(b.name));
        generateTextStyleResources(outputs, textStyles);
        return outputs;
    });
}
function fixName(name) {
    name = name.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word) {
        return word.toUpperCase();
    }).replace(/\s+/g, '');
    name = name.replace(/[&\/\\#,+()$~%.'":;*?<>{}\s]/g, "");
    return name;
}
function generateSolidColorResources(outputs, name, solidPaint) {
    const colorHex = getFigmaRGBColorHex(solidPaint.color, solidPaint.opacity);
    const colorXaml = `\t<Color x:Key="${name}Color">#${colorHex}</Color>\n`;
    const brushXaml = `\t<SolidColorBrush x:Key="${name}Brush" Color="#${colorHex}" />\n`;
    const colorCsHex = `\tpublic const string ${name} = "#${colorHex}";\n`;
    const colorCsColor = `\tpublic static readonly Color ${name} = Color.FromUint(0x${colorHex});\n`;
    AddOutput(outputs, XamlColors, colorXaml);
    AddOutput(outputs, CsColors, colorCsColor);
    AddOutput(outputs, CsHexColors, colorCsHex);
    AddOutput(outputs, XamlBrushes, brushXaml);
}
function generateGradientResources(outputs, name, gradientPaint) {
    let result = `<LinearGradientBrush  x:Key="${name}r">\n`;
    gradientPaint.gradientStops.forEach(gradientStop => {
        const colorHex = getFigmaRGBAColorHex(gradientStop.color);
        result += `\t<GradientStop Color="#${colorHex}" Offset="${gradientStop.position}"/>\n`;
    });
    result += `</LinearGradientBrush>\n`;
    AddOutput(outputs, XamlBrushes, result);
}
function generateTextStyleResources(outputs, textStyles) {
    let result = '';
    textStyles.forEach(textStyle => {
        let name = fixName(textStyle.name);
        result += `<Style x:Key="${name}" TargetType="Label">\n` +
            `  <Setter Property="FontFamily" Value="${textStyle.fontName.family}" />\n` +
            `  <Setter Property="FontSize" Value="${textStyle.fontSize}" />\n`;
        let decorations = "";
        switch (textStyle.textDecoration) {
            case "UNDERLINE":
                decorations = "Underline";
                break;
            case "STRIKETHROUGH":
                decorations = "Strikethrough";
                break;
        }
        if (decorations != "")
            result += `  <Setter Property="TextDecorations" Value="${decorations}" />\n`;
        if (textStyle.letterSpacing.unit == 'PIXELS' && textStyle.letterSpacing.value > 0)
            result += `  <Setter Property="CharacterSpacing" Value="${textStyle.letterSpacing.value}" />\n`;
        if (textStyle.lineHeight.unit == 'PERCENT' && textStyle.lineHeight.value != 1)
            result += `  <Setter Property="LineHeight" Value="${textStyle.lineHeight.value}" />\n`;
        result += `</Style>\n`;
    });
    AddOutput(outputs, XamlTextStyles, result);
}
function AddOutput(outputs, key, value) {
    let currentValue = outputs.get(key);
    if (currentValue !== undefined)
        currentValue += value;
    else
        currentValue = value;
    outputs.set(key, currentValue);
}
function getFigmaRGBColorHex(color, opacity) {
    return getFigmaColorHex(color.r, color.g, color.b, opacity);
}
function getFigmaRGBAColorHex(color) {
    return getFigmaColorHex(color.r, color.g, color.b, color.a);
}
function getFigmaColorHex(r, g, b, alpha) {
    if (alpha == undefined)
        alpha = 1;
    let hex = figmaColorToHex(alpha);
    hex += figmaColorToHex(r);
    hex += figmaColorToHex(g);
    hex += figmaColorToHex(b);
    return hex;
}
// Figma stores the color value as a 0 to 1 decimal instead of 0 to 255.
function figmaColorToHex(colorValue) {
    let rgb = Math.round(colorValue * 255);
    let hex = Number(rgb).toString(16);
    if (hex.length < 2) {
        hex = "0" + hex;
    }
    return hex.toUpperCase();
}
