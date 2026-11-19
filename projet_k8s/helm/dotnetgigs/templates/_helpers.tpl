{{/* Labels communs : project + app + tier. Usage : include "dotnetgigs.labels" (list "web" "frontend") */}}
{{- define "dotnetgigs.labels" -}}
project: dotnetgigs
app: {{ index . 0 }}
tier: {{ index . 1 }}
{{- end }}

{{/* Image d'une application du repo privé. Usage : include "dotnetgigs.image" (list $ .Values.web.tag) */}}
{{- define "dotnetgigs.image" -}}
{{ (index . 0).Values.image.repository }}:{{ index . 1 }}
{{- end }}

{{/* Affinité "preferred" vers les pods d'une ou plusieurs apps. Usage : include "dotnetgigs.affinity" (list "sql-data") */}}
{{- define "dotnetgigs.affinity" -}}
affinity:
  podAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    {{- range . }}
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchLabels: { app: {{ . }} }
        topologyKey: kubernetes.io/hostname
    {{- end }}
{{- end }}
