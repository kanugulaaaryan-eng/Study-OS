import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, ZoomIn, ZoomOut, RefreshCw, Info, FileText, FolderOpen } from "lucide-react";
import cytoscape from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import { LoadingScreen } from "@/components/LoadingScreen";

cytoscape.use(coseBilkent);

interface GraphNode {
  id: string;
  label: string;
  file_type: string;
  source_file: string;
  source_location: string;
  community: number;
  community_name: string;
  norm_label: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: any[];
  directed: boolean;
}

interface NodeData {
  id: string;
  label: string;
  file_type: string;
  source_file: string;
  source_location: string;
  community: number;
  community_name: string;
  norm_label: string;
  type: string;
  communityColor?: string;
  communitySize?: number;
}

export default function BrainPage() {
  const [, navigate] = useLocation();
  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCommunity, setSelectedCommunity] = useState<string>("all");
  const [selectedNodeData, setSelectedNodeData] = useState<NodeData | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  // Load graph data
  useEffect(() => {
    fetch("/graph.json")
      .then((res) => res.json())
      .then((data) => {
        setGraphData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load graph:", err);
        setLoading(false);
      });
  }, []);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    const nodes = graphData.nodes
      .filter((n) => n.file_type === "code")
      .map((n) => ({
        data: {
          id: n.id,
          label: n.norm_label || n.label,
          file_type: n.file_type,
          source_file: n.source_file,
          source_location: n.source_location,
          community: n.community,
          community_name: n.community_name,
          norm_label: n.norm_label,
          type: "file",
        },
      }));

    const cy = cytoscape({
      container: containerRef.current,
      elements: { nodes, edges: [] },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "font-size": "10px",
            "text-wrap": "wrap",
            "text-max-width": "80px",
            "background-color": "data(communityColor)",
            "border-width": 2,
            "border-color": "#fff",
            "border-opacity": 0.8,
            width: "mapData(communitySize, 1, 50, 20, 50)",
            height: "mapData(communitySize, 1, 50, 20, 50)",
            "text-valign": "center",
            "text-halign": "center",
            color: "#fff",
            "text-outline-width": 2,
            "text-outline-color": "data(communityColor)",
            "text-outline-opacity": 0.8,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-width": 4,
            "border-color": "#fbbf24",
            "border-opacity": 1,
            "background-color": "#fbbf24",
            color: "#1e1e1e",
          },
        },
        {
          selector: "node.filtered",
          style: {
            opacity: 0.15,
            "text-opacity": 0.15,
          },
        },
      ],
      layout: {
        name: "cose-bilkent",
        idealEdgeLength: 80,
        nodeOverlap: 20,
        nodeRepulsion: 4000,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        gravity: 80,
        numIterations: 2500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10,
        randomize: true,
      } as any,
      minZoom: 0.1,
      maxZoom: 2,
      zoomingEnabled: true,
      userZoomingEnabled: true,
      panningEnabled: true,
      userPanningEnabled: true,
      boxSelectionEnabled: true,
      selectionType: "single",
    });

    // Compute community colors and sizes
    const communityCounts: Record<number, number> = {};
    nodes.forEach((n) => {
      communityCounts[n.data.community] = (communityCounts[n.data.community] || 0) + 1;
    });

    const communityColors: Record<number, string> = {};
    const colorPalette = [
      "#8b5cf6", "#3b82f6", "#22c55e", "#ec4899", "#f97316",
      "#eab308", "#ef4444", "#06b6d4", "#84cc16", "#a855f7",
      "#f43f5e", "#14b8a6", "#6366f1", "#d946ef", "#fb923c",
    ];
    Object.keys(communityCounts).forEach((comm, i) => {
      communityColors[Number(comm)] = colorPalette[i % colorPalette.length];
    });

    // Apply community colors and sizes
    cy.nodes().forEach((node) => {
      const comm = node.data("community");
      node.data("communityColor", communityColors[comm] || "#6b7280");
      node.data("communitySize", communityCounts[comm] || 1);
    });

    // Event handlers
    cy.on("tap", "node", (evt) => {
      const node = evt.target;
      const data = node.data() as NodeData;
      setSelectedNodeData(data);
    });

    cy.on("tap", (evt) => {
      if (evt.target === cy) {
        setSelectedNodeData(null);
      }
    });

    // Search/filter
    const applyFilters = () => {
      cy.nodes().forEach((node) => {
        const label = (node.data("label") || "").toLowerCase();
        const comm = node.data("community_name") || "";
        const type = node.data("file_type") || "";
        
        const matchesSearch = !searchTerm || label.includes(searchTerm.toLowerCase());
        const matchesCommunity = selectedCommunity === "all" || comm === selectedCommunity;
        const matchesType = filterType === "all" || type === filterType;
        
        if (matchesSearch && matchesCommunity && matchesType) {
          node.removeClass("filtered");
        } else {
          node.addClass("filtered");
        }
      });
    };

    // Watch for filter changes
    const filterInterval = setInterval(applyFilters, 100);
    
    cyRef.current = cy;

    return () => {
      clearInterval(filterInterval);
      cy.destroy();
    };
  }, [containerRef.current, graphData, searchTerm, selectedCommunity, filterType]);

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingScreen label="Loading brain..." fullHeight />
      </DashboardLayout>
    );
  }

  // Get unique communities for filter
  const communities = graphData?.nodes
    .filter((n) => n.file_type === "code")
    .reduce((acc: Record<number, string>, n) => {
      acc[n.community] = n.community_name || `Community ${n.community}`;
      return acc;
    }, {}) || {};

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b bg-card">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <Info className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Project Brain 🧠</h1>
              <p className="text-xs text-muted-foreground">Codebase knowledge graph visualization</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => cyRef.current?.layout({ name: "cose-bilkent" }).run()} className="gap-1">
              <RefreshCw className="w-4 h-4" />
              Relayout
            </Button>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-b bg-background flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-muted border-border text-foreground"
            />
          </div>
          <Select value={selectedCommunity} onValueChange={setSelectedCommunity}>
            <SelectTrigger>
              <SelectValue placeholder="All Communities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Communities</SelectItem>
              {Object.entries(communities).map(([id, name]) => (
                <SelectItem key={id} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="code">Code</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <span>{graphData?.nodes?.filter(n => n.file_type === "code").length || 0} nodes</span>
          </div>
        </div>

        {/* Graph + Sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Graph Container */}
          <div className="flex-1 relative">
            <div
              ref={containerRef}
              className="w-full h-full"
              style={{ background: "#0f0f0f" }}
            />
            {/* Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-1">
              <Button variant="outline" size="icon" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() / 1.2)}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => cyRef.current?.fit()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Node Details Sidebar */}
          <div className="w-80 border-l bg-background p-4 overflow-y-auto">
            {selectedNodeData ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground">Node Details</h2>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedNodeData(null)}>
                    <Info className="w-4 h-4" />
                  </Button>
                </div>
                <Card className="bg-card border-border">
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs rounded bg-primary/10 text-primary">
                        {selectedNodeData.type === "file" ? "File" : "Function"}
                      </span>
                      <span className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400">
                        Community: {selectedNodeData.community}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Label</p>
                      <p className="text-foreground font-mono text-sm break-all">{selectedNodeData.label}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Source File</p>
                      <p className="text-foreground/80 font-mono text-xs break-all">{selectedNodeData.source_file}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Location</p>
                      <p className="text-foreground/80 font-mono text-xs">{selectedNodeData.source_location}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Community</p>
                      <p className="text-foreground/80">{selectedNodeData.community_name} (#{selectedNodeData.community})</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Normalized Label</p>
                      <p className="text-foreground/80 font-mono text-xs break-all">{selectedNodeData.norm_label}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-12">
                <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Click a node to see details</p>
                <p className="text-muted-foreground text-sm mt-2">{graphData?.nodes?.filter(n => n.file_type === "code").length || 0} code nodes loaded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}