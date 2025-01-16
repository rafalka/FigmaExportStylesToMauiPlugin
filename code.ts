// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).


// Make sure that we're in Dev Mode and running codegen
if (figma.editorType === "dev" && figma.mode === "codegen") {
  // Register a callback to the "generate" event
  figma.codegen.on("generate", async ({ node }): Promise<CodegenResult[]> => {

    const outputs = await GenerateFigmaStyles();
    let sections:CodegenResult[] = [];
    outputs.forEach( (code:string, file:string) => {
      sections.push({
        title:file,
        language: "PLAINTEXT",
        code: code
      })
    })
    
    return sections
  })
}



const  XamlColors:string = 'StaticXamlColors.xaml'
const  CsColors:string = 'StaticColors.cs'
const  CsHexColors:string = 'HexColors.cs'
const  XamlBrushes:string = 'StaticBrushes.xaml'
const  XamlTextStyles:string = 'TextStyles.xaml'

async function GenerateFigmaStyles(): Promise<Map<string, string>> {
  let outputs = new Map<string, string>();

  let paintStyles = await figma.getLocalPaintStylesAsync();
  paintStyles.sort( (a,b) => a.name.localeCompare(b.name));
  paintStyles.forEach(paintStyle => {
        paintStyle.paints.forEach(paint => {
          // let name = (paint.blendMode != undefined) ? `${paintStyle.name}${camelize(paint.blendMode)}` : paintStyle.name;
          let name = fixName(paintStyle.name);

          if (paint.type === "SOLID") {
            generateSolidColorResources(outputs, name, paint as SolidPaint);
          } else if (paint.type === 'GRADIENT_LINEAR') {
            generateGradientResources(outputs, name, paint as GradientPaint);
          }
        })
      });

  let textStyles = await figma.getLocalTextStylesAsync();
  textStyles.sort( (a,b) => a.name.localeCompare(b.name));
  generateTextStyleResources(outputs, textStyles);


  return outputs;
}

function fixName(name: string) {
  name = name.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word) {
    return word.toUpperCase();
  }).replace(/\s+/g, '');
  name = name.replace(/[&\/\\#,+()$~%.'":;*?<>{}\s]/g, "");
  return name;
}

function generateSolidColorResources(outputs: Map<string, string>, name: string, solidPaint: SolidPaint) {

  const colorHex = getFigmaRGBColorHex(solidPaint.color, solidPaint.opacity);
  const colorXaml = `\t<Color x:Key="${name}Color">#${colorHex}</Color>\n`;
  const brushXaml = `\t<SolidColorBrush x:Key="${name}Brush" Color="#${colorHex}" />\n`
  const colorCsHex = `\tpublic const string ${name} = "#${colorHex}";\n`;
  const colorCsColor = `\tpublic static readonly Color ${name} = Color.FromUint(0x${colorHex});\n`;

  AddOutput(outputs, XamlColors, colorXaml);
  AddOutput(outputs, CsColors, colorCsColor);
  AddOutput(outputs, CsHexColors, colorCsHex);
  AddOutput(outputs, XamlBrushes, brushXaml);
}



function generateGradientResources(outputs: Map<string, string>, name: string, gradientPaint: GradientPaint) {

  let result = `<LinearGradientBrush  x:Key="${name}r">\n`;
  gradientPaint.gradientStops.forEach(gradientStop => {
    const colorHex = getFigmaRGBAColorHex(gradientStop.color);
    result += `\t<GradientStop Color="#${colorHex}" Offset="${gradientStop.position}"/>\n`;
  });

  result += `</LinearGradientBrush>\n`;
  AddOutput(outputs, XamlBrushes, result);
}

function generateTextStyleResources(outputs: Map<string, string>, textStyles: TextStyle[]) {
  let result:string ='';
  textStyles.forEach(textStyle => {
    let name = fixName(textStyle.name);
    
    result += `<Style x:Key="${name}" TargetType="Label">\n`+
        `  <Setter Property="FontFamily" Value="${textStyle.fontName.family}" />\n`+
        `  <Setter Property="FontSize" Value="${textStyle.fontSize}" />\n`;
    
    let decorations:string = "";
    switch (textStyle.textDecoration)
    {
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
    if (textStyle.lineHeight.unit == 'PERCENT' && textStyle.lineHeight.value !=1)
      result += `  <Setter Property="LineHeight" Value="${textStyle.lineHeight.value}" />\n`;
    result += `</Style>\n`;
  })

  AddOutput(outputs, XamlTextStyles, result);
}

function AddOutput(outputs: Map<string, string>, key: string, value: string)
{
  let currentValue = outputs.get(key);
  if (currentValue !== undefined) currentValue +=value; else currentValue = value;
  outputs.set(key, currentValue);
}


function getFigmaRGBColorHex(color: RGB, opacity?: number):string
{
  return getFigmaColorHex(color.r, color.g, color.b, opacity);
}

function getFigmaRGBAColorHex(color: RGBA):string
{
  return getFigmaColorHex(color.r, color.g, color.b, color.a);
}

function getFigmaColorHex(r: number, g: number, b: number, alpha?: number) : string {
  if (alpha == undefined) alpha = 1;
  let hex = figmaColorToHex(alpha);
  hex += figmaColorToHex(r);
  hex += figmaColorToHex(g);
  hex += figmaColorToHex(b);
  return hex;
}



// Figma stores the color value as a 0 to 1 decimal instead of 0 to 255.
function figmaColorToHex(colorValue:number) {
  let rgb =  Math.round(colorValue * 255);
  let hex = Number(rgb).toString(16);
  if (hex.length < 2) {
    hex = "0" + hex;
  }
  return hex.toUpperCase();
}
